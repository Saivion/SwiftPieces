"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, paper, signal } from "./palette";
import { curve, follow, ms, pop, pressScale, reduced, roles, rubberBand, springValue, t, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, liquid } from "./piece-liquid";

// Navigation previews. Each shows the piece itself on the house ground, with only the scaffolding it needs to read:
// a header needs something to scroll, tabs need pages, a dock needs something to float over. That scaffolding stays
// plain and unstyled: neutral placeholder blocks, never an invented app.
// Sizes are iOS points mapped to container width (P cqw per point), so the stage scales from the grid card to the docs header.
// The chrome is liquid glass (piece-liquid.tsx), as in the pieces: every glass shape is a `Liquid` in one `LiquidGroup`
// whose state lives above it, and every string sits inside a `Liquid`, so the glass pass never draws it twice.

const P = 0.25;
/** iOS points to container units. */
const pt = (n: number) => `${+(n * P).toFixed(3)}cqw`;
/** One iOS point, the unit every `LiquidGroup` here measures in. */
const unit = pt(1);

/** Runs each `[delayMs, fn]` step once per `loopMs` cycle; every timer is cleared on unmount. */
function useTimeline(loopMs: number, steps: [number, () => void][]) {
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => { timers.forEach(clearTimeout); timers = steps.map(([at, fn]) => setTimeout(fn, at)); };
    run();
    const loop = setInterval(run, loopMs);
    return () => { clearInterval(loop); timers.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function Glyph({ d, size, stroke = 2, fill = false, style }: { d: string; size: number; stroke?: number; fill?: boolean; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: pt(size), height: pt(size), flexShrink: 0, ...style }} fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const G = {
  house: "M4 11l8-7 8 7v9h-5v-6H9v6H4v-9z",
  search: "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM20 20l-4.8-4.8",
  tray: "M4 13l2-8h12l2 8v6H4v-6zM4 13h5l1.5 2h3L15 13h5",
  person: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0",
  menu: "M4 7h16M4 12h16M4 17h16",
};

function Stage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack, ...style }}>
      {children}
    </div>
  );
}

/** A neutral block standing in for content. Nothing is drawn on it. */
function Placeholder({ height, radius = 18 }: { height: number; radius?: number }) {
  return <span className="block shrink-0" style={{ height: pt(height), borderRadius: pt(radius), background: ground.surface }} />;
}

/**
 * The filter a press shades with under reduced motion, as the piece does instead of sinking: darker on paper,
 * lighter on the dark ground. Read from the stage around `ref`, and again when the site theme flips.
 */
function useShade(ref: { current: HTMLElement | null }) {
  const [onPaper, setOnPaper] = useState(false);
  useEffect(() => {
    const read = () => { const el = ref.current; if (el) setOnPaper(getComputedStyle(el).getPropertyValue("--pv-bg").trim().toLowerCase() === paper.bg); };
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, [ref]);
  return `brightness(${onPaper ? 0.92 : 1.1})`;
}

// MARK: Stretch Header

/** 0 below `lo`, 1 above `hi` and a smoothstep between, as in the piece: a scroll-linked fade never starts or stops on a corner. */
const ramp = (v: number, lo: number, hi: number) => { const x = Math.min(Math.max((v - lo) / (hi - lo), 0), 1); return x * x * (3 - 2 * x); };

/** A spring that leaves its rest point with velocity `v0` (pt/s) and comes back to it: the scroll view's bounce at an edge. */
function kick(s: Spring, v0: number, sec: number) {
  const w = (2 * Math.PI) / s.duration, z = 1 - s.bounce, wd = w * Math.sqrt(1 - z * z);
  return Math.exp(-z * w * sec) * (v0 / wd) * Math.sin(wd * sec);
}

const SH_LOOP = 7000, SH_VIEW = 288, SH_PULL = 120, SH_DOWN = 150;
/** The pinning row's height, and the stats `StretchHeaderStats` puts on its pills. */
const SH_ROW = 42;
const SH_STATS = ["5.4 mi", "1,000 ft up", "3.5 hours"];

/**
 * The scripted scroll offset (header top: positive while pulled, negative once scrolled), `at` ms into the loop.
 * A pull resists like the scroll view's edge and rebounds on release; a flick leaves fast and decelerates; the flick
 * back home reaches the top still moving, so the edge bounces it into a small stretch.
 */
function headerOffset(at: number, still: boolean): number {
  const pulled = rubberBand(SH_PULL, SH_VIEW);
  if (still) return at < 1400 ? 0 : at < 2350 ? pulled : at < 3300 ? 0 : at < 5000 ? -SH_DOWN : 0;
  if (at < 1400) return 0;
  if (at < 2100) return rubberBand(SH_PULL * (0.5 - 0.5 * Math.cos((Math.PI * (at - 1400)) / 700)), SH_VIEW);
  if (at < 2350) return pulled;
  if (at < 3300) return pulled * (1 - springValue(roles.rebound, (at - 2350) / 1000));
  // Paced so the collapse window takes about 0.4s, as in the piece, and the hand-off reads as a move, not a cut.
  if (at < 4600) { const k = 3, s = (at - 3300) / 1000; return (-SH_DOWN * (1 - Math.exp(-k * s))) / (1 - Math.exp(-k * 1.3)); }
  if (at < 5000) return -SH_DOWN;
  // Decelerates toward a point past the top, crossing the edge at 220 pt/s, and the edge takes it from there.
  const k = 2.2, v = 220, reach = SH_DOWN + v / k, s = (at - 5000) / 1000, cross = Math.log(reach / (reach - SH_DOWN)) / k;
  return s < cross ? -SH_DOWN + reach * (1 - Math.exp(-k * s)) : kick(roles.rebound, v, s - cross);
}

/** Rest, pull to stretch the hero, flick so the row of glass stat pills pins under the solid bar, flick home. */
export function StretchHeaderPreview() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const still = reduced(), start = performance.now();
    let raf = 0;
    const tick = (now: number) => { setY(Math.round(headerOffset((now - start) % SH_LOOP, still) * 100) / 100); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // Every value below is a direct function of the offset with no transition on top, so the header never trails the scroll.
  const H = 150, BAR = 40, ABOVE = 90;
  const still = reduced();
  const stretch = Math.max(0, y), scrolled = Math.max(0, -y);
  const collapse = Math.min(1, scrolled / (H - BAR));
  const lag = still ? 0 : 0.3 * scrolled;
  const sink = still ? 0 : 0.45 * scrolled;
  const grow = still ? 1 : 1 + (0.12 * stretch) / (stretch + 70);
  const inline = ramp(collapse, 0.8, 1);
  return (
    <Stage>
      {/* The scroll viewport the header lives in: a clip, nothing more. */}
      <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: pt(292), height: pt(288), transform: "translate(-50%,-50%)", borderRadius: pt(26), background: ground.bg }}>
        {/* The hero's slot: its lower edge rides the scroll and stays joined to the row below, and a pull grows it upward. */}
        <div data-motion className="absolute inset-x-0 overflow-hidden" style={{ top: pt(-ABOVE), height: pt(H + ABOVE), background: blocks.sage, transform: `translateY(${pt(y)})` }}>
          {/* Pinned to the viewport top on a pull; on a scroll it lags at 70% speed, inside the slot. */}
          <span className="absolute rounded-full" style={{ width: pt(128), height: pt(128), right: pt(-32), top: pt(ABOVE - 32), background: blocks.butter, transform: `translateY(${pt(stretch > 0 ? -stretch : lag)})` }} />
          {/* The title lags further and shrinks, sinking behind the slot's lower edge as the header leaves. */}
          <div data-motion className="absolute" style={{ left: pt(18), bottom: pt(16), color: ink, transformOrigin: "left bottom", transform: `translateY(${pt(lag + sink)}) scale(${1 - 0.3 * collapse})`, opacity: 1 - ramp(collapse, 0.5, 0.85) }}>
            <p style={{ fontSize: pt(9), fontWeight: 600, letterSpacing: "0.12em", opacity: 0.72 * (1 - ramp(collapse, 0.2, 0.5)) }}>YOSEMITE · HIKE 04</p>
            <p style={{ fontSize: pt(34), fontWeight: font.displayWeight, letterSpacing: font.displayTracking, lineHeight: 1.05, transformOrigin: "left bottom", transform: `scale(${grow})` }}>Mist Trail</p>
          </div>
        </div>
        {/* The pinning subtitle row: the hike's stats on glass pills, resting apart, on the house ground. No lift: the
            pills sit on the row's band, so a floating shadow would spill onto the content scrolling under it. */}
        <div data-motion className="absolute inset-x-0 top-0 z-10" style={{ transform: `translateY(${pt(Math.max(H + y, BAR))})`, height: pt(SH_ROW), padding: `0 ${pt(18)}`, background: ground.bg, display: "flex", alignItems: "center" }}>
          <LiquidGroup unit={unit} lift={false}>
            <div className="flex" style={{ gap: pt(liquid.apart) }}>
              {SH_STATS.map((stat) => (
                <Liquid key={stat} className="flex items-center whitespace-nowrap" style={{ height: pt(26), paddingInline: pt(11), fontSize: pt(10.5), fontWeight: 600, color: ground.text, fontVariantNumeric: "tabular-nums" }}>{stat}</Liquid>
              ))}
            </div>
          </LiquidGroup>
        </div>
        {/* Plain placeholder content, only so there is something to scroll */}
        <div data-motion className="absolute inset-x-0 top-0 flex flex-col" style={{ transform: `translateY(${pt(H + SH_ROW + y)})`, gap: pt(10), padding: `${pt(6)} ${pt(18)}` }}>
          {[0, 1, 2, 3, 4].map((i) => <Placeholder key={i} height={46} />)}
        </div>
        {/* The bar: a solid surface that eases in, a soft shadow once collapsed, and the inline title rising in */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center" style={{ height: pt(BAR) }}>
          <div className="absolute inset-0" style={{ boxShadow: `0 ${pt(4)} ${pt(12)} rgba(0,0,0,.12)`, opacity: inline }} />
          <div data-motion className="absolute inset-0" style={{ background: ground.bg, opacity: ramp(collapse, 0, 1) }} />
          <span data-motion className="relative" style={{ fontSize: pt(13), fontWeight: 600, opacity: inline, transform: `translateY(${pt(still ? 0 : (1 - inline) * 6)})` }}>Mist Trail</span>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Tracking Tabs

const TABS: [string, number][] = [["Today", 4], ["Upcoming", 6], ["Done", 2]];

/** The pager's laid-out height, and each page's natural height (rows of 44 with gaps of 10), in points. */
const TT_PAGER = 196;
const ttPage = (rows: number) => rows * 44 + (rows - 1) * 10;
/** How far a landing carries the indicator past its title: the piece's 4 pt at this cell size, inside the titles' padding and the track's. */
const TT_CARRY = 3;
/** The carry's two legs, as the piece's keyframes: out over 100ms, back on the snap spring. */
const TT_OUT = 100;
const ttCarry = (sinceMs: number, still: boolean) => {
  if (still || sinceMs < 0) return 0;
  if (sinceMs < TT_OUT) { const k = sinceMs / TT_OUT; return k * k * (3 - 2 * k); }
  const back = sinceMs - TT_OUT;
  return back >= ms("snap") ? 0 : 1 - springValue(roles.snap, back / 1000);
};

/**
 * Taps page through the tabs and jump home across two pages. The titles sit on a clear glass track and the indicator
 * is a signal glass capsule in the same liquid: one spring with no overshoot lands the pages and the indicator rides
 * them, swelling a little while it travels and carrying a little past its title as it lands; the ink is cut by its
 * outline; pressing the selected title sinks it with the title.
 */
export function TrackingTabsPreview() {
  const [sel, setSel] = useState(0);
  const [pressed, setPressed] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  /** The landing's carry, -1 to 1 of TT_CARRY, read each frame so both glass passes move together. */
  const [carry, setCarry] = useState(0);
  /** The titles a tap carries the indicator across, until it lands. */
  const [trip, setTrip] = useState<[number, number] | null>(null);
  const page = useRef({ from: 0, to: 0, at: -1, now: 0, trip: false, landAt: -1, heading: 1 });
  const root = useRef<HTMLDivElement>(null);
  const shade = useShade(root);
  // A tap lands the page on the value spring, like native paging, so a page of text never wobbles. The indicator, its
  // swell and the ink cut are all read from that one progress; its give is its own carry, added on top.
  useEffect(() => {
    const spring: Spring = reduced() ? { duration: 0.25, bounce: 0 } : roles.value;
    let raf = 0;
    const tick = (now: number) => {
      const m = page.current;
      if (m.at >= 0) {
        const done = now - m.at >= ms(spring);
        const next = done ? m.to : m.from + (m.to - m.from) * springValue(spring, (now - m.at) / 1000);
        // The give starts with a tenth of a page to go, so it reads as the indicator carrying on, not as a second move.
        if (m.trip && Math.abs(m.now - m.to) >= 0.1 && Math.abs(next - m.to) < 0.1) { m.landAt = now; m.heading = next < m.to ? 1 : -1; }
        m.now = next;
        if (done) m.at = -1;
        setProgress(m.now);
        if (Math.abs(m.now - m.to) < 0.01) { m.trip = false; setTrip(null); }
      }
      if (m.landAt >= 0) {
        const c = ttCarry(now - m.landAt, reduced());
        setCarry(c * m.heading);
        if (now - m.landAt > TT_OUT + ms("snap")) m.landAt = -1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const go = (i: number) => {
    const m = page.current;
    setTrip([Math.min(m.to, i), Math.max(m.to, i)]);
    m.from = m.now; m.to = i; m.at = performance.now(); m.trip = true;
    setSel(i);
  };
  // Each tap presses its title first. The press is decided at touch-down, so a tap that moves the selection never sinks the indicator.
  useTimeline(6900, [
    [0, () => setPressed(null)],
    [1250, () => setPressed(1)], [1420, () => { setPressed(null); go(1); }],
    [2850, () => setPressed(2)], [3020, () => { setPressed(null); go(2); }],
    [4250, () => setPressed(2)], [4450, () => setPressed(null)],
    [5300, () => setPressed(0)], [5470, () => { setPressed(null); go(0); }],
  ]);
  const W = 300, PAD = 4, TAB = (W - PAD * 2) / 3, CELL = 38;
  const still = reduced();
  const at = Math.min(Math.max(progress, 0), TABS.length - 1);
  // Swollen a third of the way off a title; on a tap's trip it stays swollen over the titles it passes.
  let off = Math.abs(at - Math.round(at));
  if (trip && at >= trip[0] && at <= trip[1]) off = Math.min(at - trip[0], trip[1] - at, Math.abs(at - sel));
  const k = Math.min(off * 3, 1), swell = still ? 0 : k * (2 - k);
  const sx = 2.5 * swell, sy = 1.5 * swell;
  const depth = pressScale(TAB, CELL);
  const sunk = pressed === sel && !still;
  const lean = carry * TT_CARRY;
  // Under reduced motion a pressed title shades instead of sinking, and the indicator stays put.
  const press = (down: boolean) => ({ transform: `scale(${down && !still ? depth : 1})`, filter: down && still ? shade : "none", transition: t(["transform", "filter"], down ? "press" : "release") });
  const label = (title: string, count: number, color: string, countColor: string) => (
    <span className="absolute inset-0 flex items-center justify-center" style={{ gap: pt(5), color }}>
      <span style={{ fontSize: pt(13), fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: pt(10), fontWeight: 600, fontFamily: font.mono, color: countColor }}>{count}</span>
    </span>
  );
  return (
    <Stage>
      <div ref={root} className="absolute left-1/2 top-1/2" style={{ width: pt(W), transform: "translate(-50%,-50%)" }}>
        <LiquidGroup unit={unit}>
          <div className="relative">
            {/* The track: clear glass carrying the muted titles. */}
            <Liquid className="relative flex" style={{ padding: pt(PAD) }}>
              {TABS.map(([title, count], i) => (
                <span key={title} className="relative flex-1" style={{ height: pt(CELL), ...press(pressed === i) }}>
                  {label(title, count, ground.muted, ground.subtle)}
                </span>
              ))}
            </Liquid>
            {/* The indicator: signal glass in the same liquid, swelling a little while it travels. It carries the ink copy
                of the titles inside its own outline, so the ink turns exactly at its edge. */}
            <span data-motion className="absolute" style={{ top: pt(PAD), left: pt(PAD), width: pt(TAB), height: pt(CELL), transform: `translateX(${pt(at * TAB + lean)})` }}>
              <span className="absolute inset-0" style={press(sunk)}>
                <Liquid tint={signal.fill} className="absolute overflow-hidden" style={{ top: pt(-sy), bottom: pt(-sy), left: pt(-sx), right: pt(-sx) }}>
                  <span className="absolute inset-0" style={{ background: signal.fill }} />
                  <span className="absolute" style={{ top: pt(sy), left: pt(sx), width: pt(TAB * TABS.length), height: pt(CELL), transform: `translateX(${pt(-at * TAB - lean)})` }}>
                    <span className="absolute inset-0 flex">
                      {TABS.map(([title, count], i) => (
                        <span key={title} className="relative flex-1" style={press(pressed === i && !sunk)}>
                          {label(title, count, ink, "rgba(20,20,20,.62)")}
                        </span>
                      ))}
                    </span>
                  </span>
                </Liquid>
              </span>
            </span>
          </div>
        </LiquidGroup>
        {/* Plain placeholder rows, only so each page has something to page through. The pager keeps its laid-out height and
            is cut to the selected page's on the page's own spring, so the page leaving is trimmed as the new one lands. */}
        <div className="relative overflow-hidden" style={{ marginTop: pt(16), height: pt(TT_PAGER), clipPath: `inset(0 0 ${pt(TT_PAGER - Math.min(TT_PAGER, ttPage(TABS[sel][1])))} 0)`, transition: t("clip-path", "value") }}>
          <div data-motion className="flex" style={{ width: "300%", transform: `translateX(${-at * 33.3333}%)` }}>
            {TABS.map(([title, count]) => (
              <div key={title} className="flex flex-1 flex-col" style={{ gap: pt(10) }}>
                {Array.from({ length: count }, (_, i) => <Placeholder key={i} height={44} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Floating Dock

const DOCK: [string, string][] = [["Home", G.house], ["Search", G.search], ["Inbox", G.tray], ["Profile", G.person]];
/** Each item's bubble, as in the piece, and the room above the row for the name bubble and the badges. */
const KEY = 48, EDGE = 6, ICON = 19, ROOM = 56, NAME_H = 30, BADGE_H = 18;
/** How far the item under the finger rises, and how much it swells. */
const RISE = 5, SWELL = 1.14;
const keyX = (i: number) => EDGE + i * (KEY + liquid.apart) + KEY / 2;

/**
 * A count that rolls to its new value on the value spring, never past it: up for a rise, down for a drop. It rolls only
 * while its badge is out; a badge on its way home keeps the count it had, and one budding out arrives with its new one.
 */
function Count({ n, live }: { n: number; live: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef({ n, live });
  // The count on screen while hidden or leaving: the last one shown while live.
  const [held, setHeld] = useState(n);
  if (live && held !== n) setHeld(n);
  useEffect(() => {
    const was = last.current;
    last.current = { n, live };
    if (!was.live || !live || was.n === n) return;
    const el = ref.current;
    if (!el || reduced()) return;
    const { easing, ms: duration } = curve("value");
    const roll = el.animate([{ transform: `translateY(${n < was.n ? -70 : 70}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration, easing });
    return () => roll.cancel();
  }, [n, live]);
  return <span ref={ref} className="inline-block">{live ? n : held}</span>;
}

/**
 * A tap, a scrub and a second tap move the signal tint between four glass bubbles resting apart; the old bubble drains
 * as the new one floods and its symbol bounces as it lands. A scrub raises each item like a key while one glass name
 * bubble buds out above it on a liquid neck, glides with the finger, morphs its name, and melts back in on release.
 * The inbox badge is a signal bubble joined to its item: it melts in while the name is over it, buds back out, and
 * drains to clear glass once its item is selected.
 */
export function FloatingDockPreview() {
  const [sel, setSel] = useState(0);
  const [pressed, setPressed] = useState<number | null>(null);
  /** The name bubble: over `at`, out while `on`, gliding once it is out. `near` outlasts the scrub while the bubble melts home. */
  const [scrub, setScrub] = useState({ at: 1, on: false, glide: false, near: false });
  const [badge, setBadge] = useState(3);
  const [tucked, setTucked] = useState(false);
  // Names are measured once in points, so the bubble can open to widths it can't see.
  const [names, setNames] = useState<number[] | null>(null);
  const measure = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const icons = useRef<(HTMLSpanElement | null)[]>([]);
  const shade = useShade(wrap);
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    let alive = true;
    const read = () => {
      const one = (el.offsetWidth || 1) / 100;
      if (!alive) return;
      setNames(Array.from(el.children).slice(1).map((n) => Math.round(((n as HTMLElement).offsetWidth / one) * 10) / 10));
    };
    read();
    document.fonts?.ready.then(read);
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => { alive = false; ro.disconnect(); };
  }, []);
  // The symbol bounces as the tint lands under it, not as it leaves the old item; a new selection first cancels it.
  const shown = useRef(sel);
  useEffect(() => {
    if (shown.current === sel) return;
    shown.current = sel;
    if (reduced()) return;
    let bounce: Animation | undefined;
    const wait = setTimeout(() => { bounce = icons.current[sel]?.animate(...pop(0.12)); }, 120);
    return () => { clearTimeout(wait); bounce?.cancel(); };
  }, [sel]);
  useTimeline(10400, [
    [0, () => { setSel(0); setPressed(null); setScrub((s) => ({ ...s, on: false, glide: false, near: false })); setTucked(false); setBadge(3); }],
    [1330, () => setPressed(1)], [1500, () => { setPressed(null); setSel(1); }],
    // Touch-down on the open item sinks it, then the finger travels and the scrub takes over: the name buds out.
    [2730, () => setPressed(1)],
    [2900, () => { setPressed(null); setScrub({ at: 1, on: true, glide: false, near: true }); }],
    [3300, () => setScrub((s) => ({ ...s, glide: true }))],
    [3600, () => setScrub((s) => ({ ...s, at: 2 }))],
    [4300, () => setScrub((s) => ({ ...s, at: 3 }))],
    // Release: the name melts home into the item it named, which the release selects.
    [5000, () => { setScrub((s) => ({ ...s, on: false })); setSel(3); }],
    [5560, () => setScrub((s) => ({ ...s, glide: false, near: false }))],
    [6230, () => setPressed(2)], [6400, () => { setPressed(null); setSel(2); setBadge(4); }],
    [7900, () => setTucked(true)], [8900, () => setTucked(false)],
    // The loop goes home with a tap like every other, pressed first; the release at 0 selects it.
    [10230, () => setPressed(0)],
  ]);
  const still = reduced();
  const hover = scrub.on ? scrub.at : null;
  const nameOut = scrub.on;
  // The named item's badge stays melted in while the name bubble is out or on its way home over it.
  const nameOver = scrub.near ? scrub.at : null;
  const lift = still ? 0 : RISE + (KEY / 2) * (SWELL - 1);
  const nameW = (names?.[scrub.at] ?? DOCK[scrub.at][0].length * 7) + 24;
  const nameBud = { out: nameOut, rest: [0, -lift] as [number, number], home: [0, liquid.joined + NAME_H / 2 + KEY / 2] as [number, number] };
  // A key rises with a little give and drops back firm, so the one the finger left never wobbles against the one it found.
  const key = (up: boolean) => ({ transform: still ? "none" : `translateY(${pt(up ? -RISE : 0)}) scale(${up ? SWELL : 1})`, transition: t("transform", up ? follow("release", 0) : "dismiss") });
  // Under reduced motion a pressed item shades instead of sinking.
  const sink = (down: boolean) => ({ transform: `scale(${down && !still ? pressScale(KEY, KEY) : 1})`, filter: down && still ? shade : "none", transition: t(["transform", "filter"], down ? "press" : "release") });
  // The badge's leading cap rests a joined gap off the rim, 60° up the trailing side.
  const reach = KEY / 2 + liquid.joined + BADGE_H / 2;
  return (
    <Stage>
      {/* Plain placeholder content, only so the dock has something to float over */}
      <div className="absolute inset-x-0 top-0 flex flex-col" style={{ padding: `${pt(22)} ${pt(22)}`, gap: pt(12) }}>
        {[0, 1, 2, 3].map((i) => <Placeholder key={i} height={62} />)}
      </div>
      {/* The names, laid out once off stage to be measured in points. */}
      <div ref={measure} aria-hidden className="pointer-events-none absolute left-0 top-0 flex" style={{ visibility: "hidden", width: pt(100) }}>
        <span />
        {DOCK.map(([title]) => <span key={title} className="whitespace-nowrap" style={{ position: "absolute", fontSize: pt(12), fontWeight: 600 }}>{title}</span>)}
      </div>
      {/* Tucks away quick and firm, comes back a little slower. */}
      <div ref={wrap} data-motion className="absolute inset-x-0 flex justify-center" style={{ bottom: pt(16), transform: `translateY(${tucked ? pt(110) : 0})`, opacity: tucked ? 0 : 1, transition: t(["transform", "opacity"], tucked ? "dismiss" : "reveal") }}>
        {/* The house merge distance: a badge joins its item through a full neck, and the items, 26 pt apart, stay clear
            of each other. */}
        <LiquidGroup unit={unit} axis="both">
          <div className="relative flex items-end" style={{ padding: pt(EDGE), paddingTop: pt(ROOM + EDGE), gap: pt(liquid.apart) }}>
            {/* One name bubble, under the items so it melts in behind an icon: it buds out of the item under the finger
                to rest a liquid neck above it, glides with the finger while its name morphs, and on release narrows to a
                drop and melts back into the item it named. */}
            <span data-motion className="pointer-events-none absolute left-0" style={{ top: pt(ROOM + EDGE - liquid.joined), transform: `translateX(${pt(keyX(scrub.at))})`, transition: scrub.glide && !still ? t("transform", follow("snap", 1)) : "none" }}>
              <span className="absolute bottom-0 left-0" style={{ transform: "translateX(-50%)" }}>
                <Liquid bud={nameBud} className="flex items-center justify-center overflow-hidden whitespace-nowrap" style={{
                  height: pt(NAME_H), width: pt(nameOut || still ? nameW : NAME_H), color: ground.text, fontSize: pt(12), fontWeight: 600,
                  // Out, it opens to fit its name; home, it narrows to a round drop the item can hold.
                  transition: t("width", nameOut ? (scrub.glide ? follow("snap", 1) : liquid.split) : liquid.home),
                }}>
                  <BudContent out={nameOut}><MorphText text={DOCK[scrub.at][0]} /></BudContent>
                </Liquid>
              </span>
            </span>
            {DOCK.map(([title, d], i) => {
              const on = i === sel;
              const badgeOut = i === 2 && badge > 0 && nameOver !== 2;
              const tinted = badgeOut && !on;
              return (
                <span key={title} data-motion className="relative block" style={{ width: pt(KEY), height: pt(KEY), ...key(hover === i) }}>
                  <span className="absolute inset-0 block" style={sink(pressed === i)}>
                    {i === 2 ? (
                      // Under the bubble, so it melts home behind the icon.
                      <span className="absolute left-1/2 top-1/2 block" style={{ width: 0, height: 0, transform: `translate(${pt(reach * 0.5)}, ${pt(-reach * 0.866)})` }}>
                        <span className="absolute block" style={{ left: pt(-BADGE_H / 2), top: pt(-BADGE_H / 2) }}>
                          <Liquid tint={tinted ? signal.fill : undefined} bud={{ out: badgeOut, home: [-reach * 0.5, reach * 0.866] }} className="grid place-items-center overflow-hidden" style={{
                            minWidth: pt(BADGE_H), height: pt(BADGE_H), paddingInline: pt(5), color: tinted ? ink : ground.text, fontSize: pt(10.5), fontWeight: 600, fontVariantNumeric: "tabular-nums",
                            // Its tint drains on the way home, on the bubble's own spring, so it never sits red over the icon.
                            transition: t(["background-color", "color"], badgeOut ? "snap" : liquid.home),
                          }}>
                            <BudContent out={badgeOut}><Count n={badge} live={badgeOut} /></BudContent>
                          </Liquid>
                        </span>
                      </span>
                    ) : null}
                    <Liquid tint={on ? signal.fill : undefined} className="absolute inset-0 grid place-items-center" style={{ color: on ? ink : ground.muted, transition: t(["background-color", "color"], "snap") }}>
                      <span ref={(el) => { icons.current[i] = el; }} className="relative grid place-items-center" style={{ width: pt(ICON + 2), height: pt(ICON + 2) }}>
                        {/* The symbol swaps with a blur: outline away, filled in, as the tint lands. */}
                        {[false, true].map((filled) => (
                          <span key={String(filled)} data-motion className="absolute inset-0 grid place-items-center" style={{ opacity: filled === on ? 1 : 0, filter: filled === on || still ? "none" : `blur(${pt(1.5)})`, transform: `scale(${filled === on || still ? 1 : 0.8})`, transition: t(["opacity", "filter", "transform"], "snap") }}>
                            <Glyph d={d} size={ICON} fill={filled && i !== 1} stroke={filled ? 1.7 : 1.9} />
                          </span>
                        ))}
                      </span>
                    </Liquid>
                  </span>
                </span>
              );
            })}
          </div>
        </LiquidGroup>
      </div>
    </Stage>
  );
}
