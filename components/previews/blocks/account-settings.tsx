"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BlockCanvas, bu } from "./canvas";
import { blocks, font, ground, groundHex, ink, paper, shade, signal } from "../palette";
import { follow, t, tiers, type Spring } from "../piece-motion";
import { BudContent, Liquid, LiquidGroup, liquid } from "../piece-liquid";

/*
 * Account Settings, as the AccountSettingsBlock example draws it: the profile card with its glass Edit pill, the
 * Display card (GlassSegments for System, Light and Dark; the sample line over the ExpandingTrack between a small and a
 * large "A"), the Notifications card with two toggles, and the HoldToConfirm capsule with its consequence line. The
 * block is taller than the 600 pt stage, so the preview leaves out the plain Sign out row between Notifications and the
 * hold, which carries no motion of its own.
 *
 * The loop: the designed rest state on System; a tap on the opposite appearance from the page's (Dark on a light page,
 * Light on a dark one), and the screen follows it, as the app applies `.preferredColorScheme`; the text size track is
 * grabbed, swells and buds its readout, and is dragged from 100% to 130% while the sample line grows a step at a time;
 * the appearance goes back to System; Weekly summary turns on; the delete capsule is held, the red welling out of the puck and sweeping past two milestone
 * dots, then let go before it commits, so it drains back into the puck. Then everything returns to rest. Reduced motion
 * holds the rest state.
 */

/** The column inside the 20 pt margins, and the Display card's inside. */
const W = 350;
const CARD_PAD = 14;
const RADIUS = 24;
/** GlassSegments: the 40 pt row inside a 3 pt glass inset. */
const SEG_H = 40;
const SEG_INSET = 3;
const SEG_ROW = W - CARD_PAD * 2 - SEG_INSET * 2;
const SEG = SEG_ROW / 3;
/** ExpandingTrack: bar thickness at rest and swollen, and its readout bubble's height. */
const BAR_REST = 8;
const BAR_HELD = 32;
const READOUT_H = 30;
/** The text size range, as `Settings.textSizes`, and the sample line's base size. */
const SIZE_MIN = 0.7;
const SIZE_MAX = 1.3;
const SAMPLE = 17;
/** HoldToConfirm: capsule height, the puck inside it, and the hold's length. */
const HOLD_H = 60;
const PUCK = HOLD_H - 12;
const HOLD_MS = 1200;
/** The drain back into the puck: calm's pace with no bounce, as HoldToConfirm's release. */
const DRAIN: Spring = { duration: tiers.calm.duration, bounce: 0 };
const STILL: Spring = { duration: 0.25, bounce: 0 };

type Appearance = "system" | "light" | "dark";
const APPEARANCES: Appearance[] = ["system", "light", "dark"];
const TITLES: Record<Appearance, string> = { system: "System", light: "Light", dark: "Dark" };

/** The hold: resting, held (the fill sweeps), let go (it drains), and sunk back into the puck. */
type Hold = "idle" | "press" | "holding" | "draining";
/**
 * `flip` is the tap on the appearance opposite the page's; `size` the text size; `held` the track under the finger, and
 * `move` how the size got here: "jump" for a touch-down, "track" for a finger moving over the step, nothing for a
 * programmatic change. `level` is how full the hold's channel is.
 */
type Step = { flip: boolean; size: number; held: boolean; move?: "jump" | "track"; weekly: boolean; hold: Hold; level: number; ms: number };

const rest: Step = { flip: false, size: 1, held: false, weekly: false, hold: "idle", level: 0, ms: 1400 };
const flipped: Step = { ...rest, flip: true, ms: 1300 };
const grown: Step = { ...flipped, size: 1.3, ms: 800 };
const back: Step = { ...grown, flip: false, ms: 1000 };
const weekly: Step = { ...back, weekly: true, ms: 1100 };
const steps: readonly Step[] = [
  rest,
  flipped,
  // The finger lands on the bar at 100%: it swells and buds its readout.
  { ...flipped, held: true, move: "jump", ms: 420 },
  { ...flipped, size: 1.1, held: true, move: "track", ms: 240 },
  { ...flipped, size: 1.2, held: true, move: "track", ms: 240 },
  { ...flipped, size: 1.3, held: true, move: "track", ms: 240 },
  { ...flipped, size: 1.3, held: true, move: "track", ms: 420 },
  grown,
  // Back to System, so the rest of the loop plays in the page's own appearance.
  back,
  weekly,
  // Held for 70% of the hold, then let go: the fill drains back from where it was and sinks into the puck.
  { ...weekly, hold: "press", level: 0.1, ms: 120 },
  { ...weekly, hold: "holding", level: 0.71, ms: 730 },
  { ...weekly, hold: "draining", level: 0, ms: 620 },
  { ...weekly, ms: 900 },
  { ...rest, ms: 1500 },
];

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

/** Walks the script; each step holds for its `ms`, then loops. Holds the rest state under reduced motion. */
function useSteps(list: readonly Step[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const timer = setTimeout(() => setI((v) => (v + 1) % list.length), list[i].ms);
    return () => clearTimeout(timer);
  }, [i, list, reduced]);
  return { step: list[i], still: reduced };
}

/** Whether the stage this preview stands on is light: read off the ground it inherits, and again when the site theme changes. */
function useLightGround(ref: React.RefObject<HTMLElement | null>) {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const read = () => {
      const parent = ref.current?.parentElement;
      if (!parent) return;
      const bg = getComputedStyle(parent).getPropertyValue("--pv-bg").trim().toLowerCase();
      setLight(bg === paper.bg);
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, [ref]);
  return light;
}

/** The ground and ink an explicit appearance pins, as the stage's own variables, so everything under it follows. */
const pinned: Record<"light" | "dark", CSSProperties> = {
  dark: {
    ["--pv-bg" as string]: groundHex.bg, ["--pv-surface" as string]: groundHex.surface, ["--pv-raised" as string]: groundHex.raised,
    ["--pv-line" as string]: groundHex.line, ["--pv-text" as string]: groundHex.text, ["--pv-muted" as string]: groundHex.muted,
    ["--pv-subtle" as string]: groundHex.subtle, ["--pv-shadow" as string]: "1",
  },
  light: {
    ["--pv-bg" as string]: paper.bg, ["--pv-surface" as string]: paper.surface, ["--pv-raised" as string]: paper.raised,
    ["--pv-line" as string]: paper.line, ["--pv-text" as string]: paper.text, ["--pv-muted" as string]: paper.muted,
    ["--pv-subtle" as string]: paper.subtle, ["--pv-shadow" as string]: "0.36",
  },
};

const glyphs = {
  half: { d: "M12 3.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4ZM12 3.8v16.4", fill: "M12 3.8a8.2 8.2 0 0 0 0 16.4Z" },
  sun: { d: "M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8ZM12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M5.5 18.5l1.6-1.6M16.9 7.1l1.6-1.6" },
  moon: { d: "M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2Z" },
  trash: { d: "M4.5 6.8h15M9.6 6.8V4.6h4.8v2.2M6.4 6.8l.9 12.6h9.4l.9-12.6M10.2 10.3v5.8M13.8 10.3v5.8" },
  chevron: { d: "M9.5 6l6 6-6 6" },
} as const;

function Glyph({ name, size, stroke = 2, style }: { name: keyof typeof glyphs; size: number; stroke?: number; style?: CSSProperties }) {
  const g = glyphs[name] as { d: string; fill?: string };
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: bu(size), height: bu(size), flexShrink: 0, ...style }}>
      {g.fill ? <path d={g.fill} fill="currentColor" stroke="none" /> : null}
      <path d={g.d} />
    </svg>
  );
}

/** Surfaces and ink ease across when the appearance changes, as the screen re-renders in its new scheme. */
const THEME_EASE = "background-color 260ms ease, color 260ms ease";

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: ground.surface, borderRadius: bu(RADIUS), transition: THEME_EASE, ...style }}>{children}</div>;
}

function Header({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: bu(13), lineHeight: bu(18), color: ground.muted, paddingLeft: bu(16), marginBottom: bu(8), transition: THEME_EASE }}>{children}</div>;
}

// MARK: Profile

function Profile({ appearance }: { appearance?: "light" | "dark" }) {
  return (
    <Card style={{ padding: bu(12), display: "flex", alignItems: "center", gap: bu(14) }}>
      {/* "Maya Lindqvist" picks butter from the house tints. */}
      <span className="grid shrink-0 place-items-center rounded-full" style={{ width: bu(44), height: bu(44), background: blocks.butter, color: ink, fontSize: bu(16.7) }}>ML</span>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: bu(2) }}>
        <span className="truncate" style={{ fontSize: bu(17), lineHeight: bu(22), color: ground.text, transition: THEME_EASE }}>Maya Lindqvist</span>
        <span className="truncate" style={{ fontSize: bu(15), lineHeight: bu(20), color: ground.muted, transition: THEME_EASE }}>maya@example.com</span>
      </div>
      <LiquidGroup unit={bu(1)} appearance={appearance} lift={false}>
        <Liquid className="flex items-center" style={{ height: bu(32), paddingInline: bu(14), fontSize: bu(15), color: ground.text, transition: THEME_EASE }}>Edit</Liquid>
      </LiquidGroup>
    </Card>
  );
}

// MARK: Appearance

/**
 * GlassSegments: a glass track with the signal-tinted glass indicator melted into it. It hands over edge by edge: the
 * edge facing the new segment leads on the tight spring and the far edge follows on the responsive one, so it reaches
 * across and gathers in. The selected ink is a copy of the labels cut to the indicator, moving with its leading edge
 * and counter-moved inside it, so the ink hands over exactly under its edge.
 */
function Segments({ selected, appearance, still }: { selected: number; appearance?: "light" | "dark"; still: boolean }) {
  const last = useRef(selected);
  const forward = selected >= last.current;
  useEffect(() => { last.current = selected; }, [selected]);
  const lead: Spring = still ? STILL : tiers.tight, trail: Spring = still ? STILL : tiers.responsive;
  const left = SEG_INSET + selected * SEG, right = SEG_INSET + (2 - selected) * SEG;
  const leftT = t("left", forward ? trail : lead), rightT = t("right", forward ? lead : trail);
  const labels = (color: string, accessible: boolean) => APPEARANCES.map((a) => (
    <span key={a} aria-hidden={!accessible} className="flex items-center justify-center" style={{ width: bu(SEG), height: bu(SEG_H), gap: bu(6), fontSize: bu(15), color, transition: THEME_EASE }}>
      <Glyph name={a === "system" ? "half" : a === "light" ? "sun" : "moon"} size={16} stroke={1.9} />
      {TITLES[a]}
    </span>
  ));
  return (
    <LiquidGroup unit={bu(1)} appearance={appearance}>
      <div className="relative" style={{ height: bu(SEG_H + SEG_INSET * 2) }}>
        <Liquid className="absolute inset-0" />
        <Liquid tint={signal.fill} className="absolute" style={{ top: bu(SEG_INSET), height: bu(SEG_H), left: bu(left), right: bu(right), transition: `${leftT}, ${rightT}` }} />
        <div className="absolute flex" style={{ top: bu(SEG_INSET), left: bu(SEG_INSET) }}>{labels(ground.muted, true)}</div>
        <div aria-hidden className="absolute overflow-hidden" style={{ top: bu(SEG_INSET), height: bu(SEG_H), left: bu(left), right: bu(right), borderRadius: bu(SEG_H / 2), transition: `${leftT}, ${rightT}` }}>
          <div className="absolute top-0 flex" style={{ left: bu(SEG_INSET - left), transition: t("left", forward ? trail : lead) }}>{labels(signal.on, false)}</div>
        </div>
      </div>
    </LiquidGroup>
  );
}

// MARK: Text size

/**
 * ExpandingTrack between a small and a large "A": a glass bar with the red fill inside it. Under the finger it swells
 * from 8 to 32 pt with no overshoot, shows its detent dots a beat behind, and buds the percentage up out of the bar on
 * a glass bubble that rides the held edge; let go, it deflates with a little give and the bubble melts home.
 */
function TextSize({ s, appearance, still }: { s: Step; appearance?: "light" | "dark"; still: boolean }) {
  const frac = (s.size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN);
  const h = s.held && !still ? BAR_HELD : BAR_REST, r = Math.min(h / 2, 12);
  const band = s.held ? "press" : "release";
  // The value never animates under the finger; a programmatic change lands on the snap spring.
  const moveT = (p: string) => (s.move === "jump" ? `${p} 0ms` : s.move === "track" ? `${p} ${s.ms}ms linear` : t(p, still ? STILL : "snap"));
  const label = `${Math.round(s.size * 100)}%`;
  const rw = Math.max(READOUT_H * 1.5, 24 + label.length * 9.2);
  const out = s.held;
  const rise = h / 2 + liquid.joined + READOUT_H / 2;
  const fit = Math.min(1, (BAR_REST * 0.9) / (READOUT_H * liquid.homeScale));
  const dots = (color: string) => (
    <span className="absolute inset-0" style={{ opacity: s.held ? 1 : 0, transition: t("opacity", follow("press", 1)) }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="absolute rounded-full" style={{ left: `${(i / 6) * 100}%`, top: "50%", width: bu(3), height: bu(3), background: color, transform: "translate(-50%, -50%)" }} />
      ))}
    </span>
  );
  const span = `inset(0 ${((1 - frac) * 100).toFixed(2)}% 0 0)`;
  return (
    <div>
      {/* The sample sits on the bottom of a box sized for 130%, so it grows upward and nothing below moves. */}
      <div className="flex items-end" style={{ height: bu(28) }}>
        <span className="whitespace-nowrap" style={{ fontSize: bu(SAMPLE * s.size), lineHeight: 1.2, color: ground.text, transition: `${t("font-size", still ? STILL : "value")}, color 260ms ease` }}>Text looks like this.</span>
      </div>
      <div className="flex items-center" style={{ marginTop: bu(24), height: bu(44), gap: bu(12) }}>
        <span style={{ fontSize: bu(13), color: ground.muted, transition: THEME_EASE }}>A</span>
        <LiquidGroup unit={bu(1)} axis="both" appearance={appearance} className="flex-1" style={{ height: bu(44) }}>
          <div className="relative" style={{ height: bu(44) }}>
            {/* The readout bubble, under the bar, so at home it sits inside it. The wrapper tracks the held edge. */}
            <span className="absolute top-1/2" style={{
              marginTop: bu(-READOUT_H / 2), width: bu(rw),
              left: `clamp(0px, calc(${(frac * 100).toFixed(2)}% - ${bu(rw / 2)}), calc(100% - ${bu(rw)}))`,
              transition: moveT("left"),
            }}>
              <Liquid className="flex items-center justify-center" style={{
                width: bu(rw), height: bu(READOUT_H),
                transform: `translateY(${bu(out ? -rise : 0)}) scale(${out ? 1 : liquid.homeScale * fit})`,
                transition: t("transform", out ? liquid.split : liquid.home),
              }}>
                <BudContent out={out}>
                  <span className="tabular-nums" style={{ fontFamily: font.rounded, fontSize: bu(15), lineHeight: 1, color: ground.text }}>{label}</span>
                </BudContent>
              </Liquid>
            </span>
            <div className="absolute inset-0 flex items-center">
              {/* Laid out once at full thickness; the swell animates its clip, so nothing is laid out per frame. */}
              <Liquid radius={12} className="relative w-full overflow-hidden" style={{ height: bu(BAR_HELD), clipPath: `inset(${bu((BAR_HELD - h) / 2)} 0 round ${bu(r)})`, transition: t("clip-path", band) }}>
                {dots(`color-mix(in srgb, ${ground.text} 22%, transparent)`)}
                <span className="absolute inset-0" style={{ background: signal.fill, clipPath: span, transition: moveT("clip-path") }} />
                <span className="absolute inset-0" style={{ clipPath: span, transition: moveT("clip-path") }}>{dots("rgba(20,20,20,.35)")}</span>
              </Liquid>
            </div>
          </div>
        </LiquidGroup>
        <span style={{ fontSize: bu(22), color: ground.muted, transition: THEME_EASE }}>A</span>
      </div>
    </div>
  );
}

// MARK: Notifications

/** A native toggle in the house red: the knob slides on the snap spring and the track takes the tint. */
function Toggle({ on, still }: { on: boolean; still: boolean }) {
  const TW = 63, TH = 28, KW = 37, KH = 24;
  return (
    <span className="relative shrink-0 rounded-full" style={{
      width: bu(TW), height: bu(TH),
      background: on ? signal.fill : `color-mix(in srgb, ${ground.muted} 40%, ${ground.surface})`,
      transition: t("background-color", still ? STILL : "snap"),
    }}>
      <span className="absolute rounded-full" style={{
        left: bu(2), top: bu(2), width: bu(KW), height: bu(KH), background: "#ffffff",
        boxShadow: `0 ${bu(1)} ${bu(3)} ${shade(0.25)}`,
        transform: `translateX(${bu(on ? TW - KW - 4 : 0)})`, transition: t("transform", still ? STILL : "snap"),
      }} />
    </span>
  );
}

function Row({ title, on, still }: { title: string; on: boolean; still: boolean }) {
  return (
    <div className="flex items-center justify-between" style={{ height: bu(52), paddingInline: bu(16) }}>
      <span style={{ fontSize: bu(17), color: ground.text, transition: THEME_EASE }}>{title}</span>
      <Toggle on={on} still={still} />
    </div>
  );
}

// MARK: Hold to delete

/**
 * HoldToConfirm: the clear glass capsule with the red puck. Held, the red wells out of the puck to the capsule's height
 * and sweeps through the glass at the hold's steady pace, swelling each milestone dot it passes and inverting the
 * label under its edge; let go early, it drains back on a spring with no bounce and sinks into the puck.
 */
function HoldCapsule({ s, appearance, still }: { s: Step; appearance?: "light" | "dark"; still: boolean }) {
  const welled = s.hold !== "idle";
  const g = still ? 1 : welled ? 1 : PUCK / HOLD_H;
  const level = s.level;
  const rim = (HOLD_H / 2) * (1 - g);
  const clip = `inset(${bu(rim)} calc(100% - ${bu(rim + HOLD_H * g)} - (100% - ${bu(HOLD_H)}) * ${(level * g).toFixed(4)}) ${bu(rim)} ${bu(rim)} round ${bu((HOLD_H / 2) * g)})`;
  const clipT = s.hold === "press" ? t("clip-path", "press")
    : s.hold === "holding" ? `clip-path ${s.ms}ms linear`
    : s.hold === "draining" ? t("clip-path", still ? STILL : DRAIN)
    : t("clip-path", still ? STILL : "dismiss");
  const passed = (i: number) => welled && s.hold !== "draining" && level >= i / 4;
  const dots = (color: string, onFill: boolean) => [1, 2, 3].map((i) => (
    <span key={i} className="absolute rounded-full" style={{
      left: `calc(${bu(HOLD_H)} + (100% - ${bu(HOLD_H)}) * ${i / 4})`, top: bu(HOLD_H - 9), width: bu(5), height: bu(5), margin: bu(-2.5), background: color,
      transform: onFill && passed(i) && !still ? "scale(1.6)" : "scale(1)",
      transition: t("transform", follow("settle", 0), onFill && passed(i) ? ((i / 4 - 0.1) / 0.61) * 730 : 0),
    }} />
  ));
  const title = (color: string) => (
    <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap" style={{ paddingInline: bu(PUCK + 6), fontSize: bu(17), color, transition: THEME_EASE }}>Hold to delete account</span>
  );
  return (
    <div style={{ transform: s.hold === "press" || s.hold === "holding" ? (still ? "none" : "scale(0.98)") : "none", transition: t("transform", s.hold === "press" || s.hold === "holding" ? "press" : "release") }}>
      <LiquidGroup unit={bu(1)} appearance={appearance}>
        <Liquid className="relative overflow-hidden" style={{ height: bu(HOLD_H) }}>
          {dots(`color-mix(in srgb, ${ground.text} 28%, transparent)`, false)}
          {title(ground.text)}
          <span className="absolute grid place-items-center rounded-full" style={{ left: bu(6), top: bu(6), width: bu(PUCK), height: bu(PUCK), background: signal.fill, color: ink }}>
            <Glyph name="trash" size={22} stroke={2} />
          </span>
          {/* The fill and an ink copy of everything on it, cut to the channel, so they invert exactly under its edge. */}
          <div className="absolute inset-0" style={{ background: signal.fill, clipPath: clip, transition: clipT, opacity: still && !welled ? 0 : 1 }}>
            {dots("rgba(20,20,20,.6)", true)}
            {title(ink)}
            <span className="absolute grid place-items-center" style={{ left: bu(6), top: bu(6), width: bu(PUCK), height: bu(PUCK), color: ink }}>
              <Glyph name="trash" size={22} stroke={2} />
            </span>
          </div>
        </Liquid>
      </LiquidGroup>
    </div>
  );
}

export function AccountSettingsBlockPreview() {
  const { step: s, still } = useSteps(steps);
  const root = useRef<HTMLDivElement>(null);
  const lightGround = useLightGround(root);
  // The tap goes to the appearance opposite the page's, so the screen visibly follows it in either site theme.
  const target: Appearance = lightGround ? "dark" : "light";
  const chosen: Appearance = s.flip ? target : "system";
  const pin = chosen === "system" ? undefined : chosen;
  return (
    <div ref={root} className="absolute inset-0" style={{ background: ground.bg, transition: THEME_EASE, fontFamily: font.stack, fontWeight: 600, color: ground.text, ...(pin ? pinned[pin] : null) }}>
      <BlockCanvas className="justify-center">
        <div className="flex flex-col" style={{ width: bu(W) }}>
          <Profile appearance={pin} />
          <div style={{ marginTop: bu(18) }}>
            <Header>Display</Header>
            <Card style={{ padding: `${bu(CARD_PAD)} ${bu(CARD_PAD)} ${bu(2)}` }}>
              <Segments selected={APPEARANCES.indexOf(chosen)} appearance={pin} still={still} />
              <div style={{ marginTop: bu(16) }}><TextSize s={s} appearance={pin} still={still} /></div>
            </Card>
          </div>
          <div style={{ marginTop: bu(18) }}>
            <Header>Notifications</Header>
            <Card>
              <Row title="Reminders" on still={still} />
              <div style={{ height: 1, marginLeft: bu(16), background: ground.line, transition: THEME_EASE }} />
              <Row title="Weekly summary" on={s.weekly} still={still} />
            </Card>
          </div>
          <div style={{ marginTop: bu(18) }}>
            <HoldCapsule s={s} appearance={pin} still={still} />
            <div style={{ marginTop: bu(10), paddingLeft: bu(16), fontSize: bu(13), lineHeight: bu(18), color: ground.muted, transition: THEME_EASE }}>Removes your profile and data for good.</div>
          </div>
        </div>
      </BlockCanvas>
    </div>
  );
}
