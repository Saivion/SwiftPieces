"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink } from "./palette";

/*
 * Inputs: Expanding Track, Scrub Stepper, Filter Rail, Secure Entry.
 * Each preview shows the component and nothing else: no card around it, no headings, no invented app UI.
 * The only text is what the component itself renders (its label, its readout, its chips).
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`, so the stage scales as one picture.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const trough = "#2a2a2a";

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

/** Walks a scripted list of states; each holds for `ms`, then loops. Holds the first (resting) state under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return steps[i];
}

const glyphs = {
  speaker: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  sun: "M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  check: "M5 12.5l4.5 4.5L19 7",
  xmark: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  minus: "M6 12h12",
  plus: "M12 6v12M6 12h12",
  eye: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6ZM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z",
  bang: "M12 6v7.5M12 17.6v.2",
} as const;

function Glyph({ name, size, stroke = 2.4, style }: { name: keyof typeof glyphs; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}>
      <path d={glyphs[name]} />
    </svg>
  );
}

/** The charcoal ground. Nothing sits on it but the component. */
function Stage({ children, width = 440, scale = 1 }: { children: ReactNode; width?: number; scale?: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <div style={{ width: u(width), transform: scale === 1 ? undefined : `scale(${scale})` }}>{children}</div>
    </div>
  );
}

const meta: CSSProperties = { fontSize: u(11), fontWeight: 600, letterSpacing: "0.1em", color: ground.muted, textTransform: "uppercase", lineHeight: 1 };

/** A number whose decimals read quieter, as `ExpandingTrack` draws its title numeral. */
function Numeral({ value, size }: { value: string; size: number }) {
  const cut = value.lastIndexOf(".");
  const whole = cut > 0 ? value.slice(0, cut) : value, frac = cut > 0 ? value.slice(cut) : "";
  return (
    <span className="tabular-nums" style={{ fontSize: u(size), fontWeight: font.numeralWeight, letterSpacing: "-0.02em", lineHeight: 1 }}>
      {whole}<span style={{ color: ground.muted }}>{frac}</span>
    </span>
  );
}

// MARK: Expanding Track

type TrackState = { vol: number; warm: number; lo: number; hi: number; active: "" | "vol" | "lo"; over?: boolean; ms: number };
const trackSteps: readonly TrackState[] = [
  { vol: 0.62, warm: 0.18, lo: 0.2, hi: 0.8, active: "", ms: 1500 },
  { vol: 0.74, warm: 0.18, lo: 0.2, hi: 0.8, active: "vol", ms: 380 },
  { vol: 0.88, warm: 0.18, lo: 0.2, hi: 0.8, active: "vol", ms: 420 },
  { vol: 1, warm: 0.18, lo: 0.2, hi: 0.8, active: "vol", over: true, ms: 480 },
  { vol: 1, warm: 0.18, lo: 0.2, hi: 0.8, active: "", ms: 1000 },
  { vol: 1, warm: 0.18, lo: 0.3, hi: 0.8, active: "lo", ms: 420 },
  { vol: 1, warm: 0.18, lo: 0.4, hi: 0.8, active: "lo", ms: 520 },
  { vol: 1, warm: 0.18, lo: 0.4, hi: 0.8, active: "", ms: 1100 },
  { vol: 0.62, warm: 0.18, lo: 0.2, hi: 0.8, active: "", ms: 900 },
];

function Track({ lo = 0, hi, fill, active, over, handles, dots, symbol }: { lo?: number; hi: number; fill: string; active: boolean; over?: boolean; handles?: boolean; dots: number; symbol?: keyof typeof glyphs }) {
  const h = active ? 30 : 8, r = Math.min(h / 2, 12);
  const move = `left .45s ${ease}, width .45s ${ease}`;
  const dotRow = (color: string) => (
    <span data-motion className="absolute inset-0" style={{ opacity: active ? 1 : 0, transition: "opacity .25s" }}>
      {Array.from({ length: dots - 1 }, (_, i) => (
        <span key={i} className="absolute rounded-full" style={{ left: `${((i + 1) / dots) * 100}%`, top: "50%", width: u(3), height: u(3), background: color, transform: "translate(-50%, -50%)" }} />
      ))}
    </span>
  );
  return (
    <div className="flex items-center" style={{ height: u(40), gap: u(12) }}>
      {symbol ? <span style={{ color: active ? ground.text : ground.muted, width: u(24), display: "flex", justifyContent: "center", transition: "color .2s" }}><Glyph name={symbol} size={19} stroke={2} /></span> : null}
      <div data-motion className="relative flex-1 overflow-hidden" style={{
        height: u(h), borderRadius: u(r), background: trough,
        transform: `scaleX(${over ? 0.94 : 1})`, transformOrigin: "left",
        boxShadow: active ? `0 ${u(4)} ${u(12)} rgba(0,0,0,.3)` : "none",
        transition: `height .35s ${spring}, border-radius .35s ${spring}, transform ${over ? ".25s ease-out" : `.5s ${spring}`}, box-shadow .3s`,
      }}>
        {dotRow("rgba(244,243,239,.22)")}
        <span data-motion className="absolute inset-y-0" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%`, background: fill, transition: move }} />
        <span data-motion className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - hi) * 100}% 0 ${lo * 100}%)`, transition: `clip-path .45s ${ease}` }}>{dotRow("rgba(20,20,20,.35)")}</span>
        {handles ? (["lo", "hi"] as const).map((k) => {
          const sunk = active && k === "lo";
          return <span key={k} data-motion className="absolute top-1/2 rounded-full" style={{ left: `calc(${(k === "lo" ? lo : hi) * 100}% ${k === "lo" ? "+" : "-"} ${u(7)})`, width: u(3), height: u(Math.max(h * 0.5, 4)), background: ink, opacity: sunk ? 0.4 : 0.85, transform: `translate(-50%, -50%) scale(${sunk ? 0.5 : 1})`, transition: `left .45s ${ease}, height .35s ${spring}, transform .2s, opacity .2s` }} />;
        }) : null}
      </div>
    </div>
  );
}

function TrackHeader({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-end justify-between" style={{ gap: u(12) }}>
      <span className="whitespace-nowrap" style={{ ...meta, paddingBottom: u(4) }}>{label}</span>
      {children}
    </div>
  );
}

export function ExpandingTrackPreview() {
  const s = useSteps(trackSteps);
  const warmK = Math.round((2700 + s.warm * 3800) / 100) * 100;
  return (
    <Stage width={448}>
      <div className="flex flex-col" style={{ gap: u(22) }}>
        <div>
          <TrackHeader label="Volume"><Numeral value={String(Math.round(s.vol * 100))} size={36} /></TrackHeader>
          <Track hi={s.vol} fill={blocks.tangerine} active={s.active === "vol"} over={s.over} dots={10} symbol="speaker" />
        </div>
        <div>
          <TrackHeader label="Warmth"><Numeral value={`${warmK}K`} size={36} /></TrackHeader>
          <Track hi={s.warm} fill={blocks.butter} active={false} dots={38} symbol="sun" />
        </div>
        <div>
          <TrackHeader label="Price per night">
            <span className="whitespace-nowrap tabular-nums" style={{ fontSize: u(32), fontWeight: font.numeralWeight, lineHeight: 1, letterSpacing: "-0.02em" }}>
              ${Math.round(s.lo * 200)}<span style={{ color: ground.muted }}> – </span>${Math.round(s.hi * 200)}
            </span>
          </TrackHeader>
          <Track lo={s.lo} hi={s.hi} fill={blocks.sky} active={s.active === "lo"} handles dots={40} />
        </div>
      </div>
    </Stage>
  );
}

// MARK: Scrub Stepper

type StepperState = { guests: number; chairs: number; press?: "minus" | "plus"; pressChairs?: boolean; scrub?: boolean; shift?: number; nudge?: number; ms: number };
const stepperSteps: readonly StepperState[] = [
  { guests: 4, chairs: 0, ms: 1400 },
  { guests: 4, chairs: 0, press: "plus", ms: 140 }, { guests: 5, chairs: 0, ms: 600 },
  { guests: 5, chairs: 0, press: "plus", ms: 140 }, { guests: 6, chairs: 0, ms: 900 },
  { guests: 6, chairs: 0, scrub: true, shift: 0, ms: 240 }, { guests: 7, chairs: 0, scrub: true, shift: 5, ms: 160 },
  { guests: 8, chairs: 0, scrub: true, shift: 10, ms: 160 }, { guests: 9, chairs: 0, scrub: true, shift: 3, ms: 160 },
  { guests: 10, chairs: 0, scrub: true, shift: 8, ms: 300 }, { guests: 10, chairs: 0, scrub: true, shift: 11, nudge: 6, ms: 360 },
  { guests: 10, chairs: 0, ms: 1100 },
  { guests: 10, chairs: 0, pressChairs: true, ms: 140 }, { guests: 10, chairs: 1, ms: 1300 },
  { guests: 4, chairs: 0, ms: 700 },
];

function Stepper({ value, min, max, block, press, scrub, shift = 0, nudge = 0 }: { value: number; min: number; max: number; block: string; press?: "minus" | "plus"; scrub?: boolean; shift?: number; nudge?: number }) {
  const H = 50, inset = 5, inner = H - inset * 2;
  const button = (name: "minus" | "plus", enabled: boolean) => {
    const down = press === name;
    return (
      <span className="flex items-center justify-center" style={{ width: u(H), height: u(H) }}>
        <span data-motion className="flex items-center justify-center rounded-full" style={{
          width: u(inner), height: u(inner), background: down ? ground.text : "#3a3a3a", color: down ? "#3a3a3a" : ground.text,
          opacity: enabled ? 1 : 0.35, transform: `scale(${down ? 0.86 : 1})`, transition: `transform .3s ${spring}, background-color .15s, color .15s, opacity .2s`,
        }}><Glyph name={name} size={15} stroke={3} /></span>
      </span>
    );
  };
  return (
    <span data-motion className="flex items-center rounded-full" style={{ height: u(H), background: "#262626", transform: `translateX(${u(nudge)})`, transition: `transform ${nudge ? ".3s" : ".45s"} ${spring}` }}>
      {button("minus", value > min)}
      <span data-motion className="relative flex items-center justify-center overflow-hidden" style={{
        height: u(inner), minWidth: u(62), paddingInline: u(scrub ? 20 : 14), borderRadius: u(14), background: block, color: ink,
        transform: `scale(${scrub ? 1.04 : 1})`, transition: `padding .3s ${spring}, transform .3s ${spring}`,
      }}>
        <span key={value} data-motion className="tabular-nums" style={{ fontFamily: font.rounded, fontSize: u(22), fontWeight: 600, lineHeight: 1, animation: `in-roll .25s ${ease} both` }}>{value}</span>
        <span data-motion className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: u(10), opacity: scrub ? 1 : 0, transition: "opacity .2s", maskImage: "linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)" }}>
          <span data-motion className="absolute bottom-0 flex items-end" style={{ left: u(-14 + (shift % 14)), gap: u(5.5), transition: `left .16s linear` }}>
            {Array.from({ length: 16 }, (_, i) => <span key={i} style={{ width: u(1.5), height: u(i % 2 ? 4 : 7), borderRadius: u(1), background: "rgba(20,20,20,.4)" }} />)}
          </span>
        </span>
      </span>
      {button("plus", value < max)}
    </span>
  );
}

export function ScrubStepperPreview() {
  const s = useSteps(stepperSteps);
  return (
    <Stage width={200} scale={2.6}>
      <style>{`@keyframes in-roll{from{transform:translateY(40%);opacity:0;filter:blur(2px)}to{transform:none;opacity:1;filter:none}}`}</style>
      <div className="flex flex-col items-center" style={{ gap: u(14) }}>
        <Stepper value={s.guests} min={1} max={10} block={blocks.butter} press={s.press} scrub={s.scrub} shift={s.shift} nudge={s.nudge} />
        <Stepper value={s.chairs} min={0} max={3} block={blocks.sage} press={s.pressChairs ? "plus" : undefined} />
      </div>
    </Stage>
  );
}

// MARK: Filter Rail

const SORTS = ["Recent", "Popular", "A to Z", "Longest", "Shortest"];
const GENRES = ["All", "Jazz", "Hip-Hop", "Classical", "Electronic", "Folk", "Ambient"];
const COUNTS: Record<string, number> = { All: 412, Jazz: 38, "Hip-Hop": 52, Classical: 21, Electronic: 64, Folk: 17, Ambient: 29 };
const GENRE_BLOCKS = [blocks.tangerine, blocks.sky, blocks.butter, blocks.sage, blocks.lilac, blocks.sand];
const railSteps: readonly { sort: string; genres: string[]; ms: number }[] = [
  { sort: "Recent", genres: [], ms: 1500 },
  { sort: "Popular", genres: [], ms: 1100 },
  { sort: "Popular", genres: ["Jazz"], ms: 1000 },
  { sort: "Longest", genres: ["Jazz", "Ambient"], ms: 1200 },
  { sort: "Longest", genres: ["Jazz", "Ambient", "Electronic"], ms: 1600 },
  { sort: "A to Z", genres: [], ms: 1000 },
];

/** Chip widths are estimated from text length (px at the 560 stage) and laid out like the Swift `HStack`; everything is in `cqw`, so no measuring is needed. */
function Rail({ options, selected, multi, counts }: { options: string[]; selected: string[]; multi?: boolean; counts?: Record<string, number> }) {
  const RAIL_W = 372, INSET = 16, GAP = 6, H = 36;
  const on = (o: string) => selected.includes(o);
  const ordered = multi ? [...options.filter(on), ...options.filter((o) => !on(o))] : options;
  const clear = !!multi && selected.length > 0;
  const widthOf = (o: string) => Math.round(o.length * 7.6 + 32 + (multi && on(o) ? 18 : 0) + (counts ? String(counts[o]).length * 7 + 6 : 0));
  let x = INSET + (clear ? 58 + GAP : 0);
  const pos = ordered.map((o) => { const w = widthOf(o), p = { o, x, w }; x += w + GAP; return p; });
  const contentW = x - GAP + INSET;
  const sel = multi ? undefined : pos.find((p) => on(p.o));
  const scroll = sel ? Math.max(0, Math.min(sel.x + sel.w / 2 - RAIL_W / 2, contentW - RAIL_W)) : 0;
  const leftFade = scroll > 1, rightFade = contentW - scroll > RAIL_W + 1;
  const mask = `linear-gradient(90deg, ${leftFade ? "transparent" : "#000"}, #000 ${u(28)}, #000 calc(100% - ${u(28)}), ${rightFade ? "transparent" : "#000"})`;
  return (
    <div className="relative overflow-hidden" style={{ height: u(44), maskImage: mask, WebkitMaskImage: mask }}>
      <div data-motion className="absolute inset-y-0 left-0" style={{ transform: `translateX(${u(-scroll)})`, transition: `transform .45s ${ease}` }}>
        {multi ? (
          <span data-motion className="absolute flex items-center justify-center rounded-full tabular-nums" style={{ left: u(INSET), top: u(4), width: u(58), height: u(H), gap: u(5), background: ground.text, color: ground.bg, fontSize: u(14), fontWeight: 600, transform: `scale(${clear ? 1 : 0.6})`, opacity: clear ? 1 : 0, transition: `transform .35s ${spring}, opacity .25s` }}>
            <Glyph name="xmark" size={12} stroke={3.2} />{selected.length || ""}
          </span>
        ) : null}
        {sel ? <span data-motion className="absolute rounded-full" style={{ left: u(sel.x), top: u(4), width: u(sel.w), height: u(H), background: ground.text, transition: `left .45s ${spring}, width .45s ${spring}` }} /> : null}
        {pos.map((p) => {
          const picked = on(p.o);
          const fill = multi && picked ? GENRE_BLOCKS[options.indexOf(p.o) % GENRE_BLOCKS.length] : !multi && picked ? "transparent" : "#262626";
          const color = picked ? (multi ? ink : ground.bg) : ground.text;
          return (
            <span key={p.o} data-motion className="absolute flex items-center justify-center whitespace-nowrap rounded-full" style={{
              left: u(p.x), top: u(4), width: u(p.w), height: u(H), gap: u(6), background: fill, color, fontSize: u(14), fontWeight: 600,
              transition: `left .45s ${spring}, width .35s ${spring}, background-color .25s, color .25s`,
            }}>
              {multi && picked ? <span data-motion style={{ display: "flex", animation: `in-pop .3s ${spring} both` }}><Glyph name="check" size={12} stroke={3.4} /></span> : null}
              {p.o}
              {counts ? <span className="tabular-nums" style={{ fontSize: u(12), fontWeight: 500, color: picked ? "rgba(20,20,20,.62)" : ground.muted }}>{counts[p.o]}</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function FilterRailPreview() {
  const { sort, genres } = useSteps(railSteps);
  return (
    <Stage width={372} scale={1.28}>
      <style>{`@keyframes in-pop{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}`}</style>
      <div className="flex flex-col" style={{ gap: u(16) }}>
        <Rail options={SORTS} selected={[sort]} />
        <Rail options={GENRES} selected={genres} multi counts={COUNTS} />
      </div>
    </Stage>
  );
}

// MARK: Secure Entry

const TARGET = "Juniper42!";
type SecureState = { typed: number; focus: "new" | "none"; error: boolean; ms: number };
const secureSteps: readonly SecureState[] = [
  { typed: 5, focus: "new", error: false, ms: 1300 },
  ...Array.from({ length: 5 }, (_, i) => ({ typed: 6 + i, focus: "new" as const, error: false, ms: i === 4 ? 1500 : 230 })),
  { typed: 10, focus: "none", error: true, ms: 2000 },
  { typed: 10, focus: "none", error: false, ms: 900 },
];
const LEVELS = [["Weak", blocks.tangerine], ["Fair", blocks.butter], ["Good", blocks.sky], ["Strong", blocks.sage]] as const;

function Field({ label, dots, focused, error, check }: { label: string; dots: number; focused?: boolean; error?: boolean; check?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!error || reduced || !ref.current) return;
    const a = ref.current.animate([0, 6.1, 0, -4.4, 0, 2.6, 0, -0.9, 0].map((x) => ({ transform: `translateX(${x * 0.18}cqw)` })), { duration: 450, easing: "linear" });
    return () => a.cancel();
  }, [error, reduced]);
  return (
    <div>
      <p style={meta}>{label}</p>
      <div ref={ref} className="flex items-center" style={{
        marginTop: u(8), height: u(48), paddingLeft: u(16), paddingRight: u(5), borderRadius: u(16), background: "#262626",
        boxShadow: `inset 0 0 0 ${u(2)} ${error ? blocks.tangerine : focused ? ground.text : "transparent"}`, transition: "box-shadow .2s",
      }}>
        <span className="flex flex-1 items-center" style={{ gap: u(4) }}>
          {Array.from({ length: dots }, (_, i) => <span key={i} className="rounded-full" style={{ width: u(7), height: u(7), background: ground.text }} />)}
          {focused ? <span data-motion style={{ width: u(2), height: u(20), marginLeft: u(2), background: ground.text, animation: "in-caret 1s steps(1) infinite" }} /> : null}
        </span>
        <span data-motion className="flex items-center justify-center rounded-full" style={{ width: u(24), height: u(24), marginRight: u(6), background: blocks.sage, color: ink, opacity: check ? 1 : 0, transform: `scale(${check ? 1 : 0.4})`, transition: `transform .35s ${spring}, opacity .2s` }}><Glyph name="check" size={13} stroke={3.4} /></span>
        <span className="flex items-center justify-center rounded-full" style={{ width: u(36), height: u(36), background: "#3a3a3a", color: ground.text }}><Glyph name="eye" size={17} stroke={2} /></span>
      </div>
    </div>
  );
}

export function SecureEntryPreview() {
  const s = useSteps(secureSteps);
  const pw = TARGET.slice(0, s.typed);
  const reqs: [string, boolean][] = [["8+ characters", pw.length >= 8], ["A number", /\d/.test(pw)], ["A symbol", /[^\p{L}\p{N}\s]/u.test(pw)], ["Mixed case", /[a-z]/.test(pw) && /[A-Z]/.test(pw)]];
  const passed = reqs.filter(([, m]) => m).length, score = Math.max(passed, 1), complete = passed === 4;
  const [level, levelColor] = LEVELS[score - 1];
  return (
    <Stage width={452}>
      <style>{`@keyframes in-caret{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
      <div className="flex flex-col" style={{ gap: u(10) }}>
        <Field label="New password" dots={pw.length} focused={s.focus === "new"} check={complete} />
        <div className="flex items-center" style={{ gap: u(10) }}>
          <span className="relative flex-1 overflow-hidden rounded-full" style={{ height: u(8), background: "#262626" }}>
            <span data-motion className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${score * 25}%`, background: levelColor, transition: `width .45s ${spring}, background-color .3s` }} />
          </span>
          <span data-motion className="flex items-center justify-center rounded-full" style={{ width: u(64), height: u(22), background: levelColor, color: ink, fontSize: u(10), fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", transition: "background-color .3s" }}>{level}</span>
        </div>
        <div data-motion className="grid" style={{ gridTemplateRows: complete ? "0fr" : "1fr", opacity: complete ? 0 : 1, transition: `grid-template-rows .45s ${ease}, opacity .3s` }}>
          <div className="grid min-h-0 grid-cols-2 overflow-hidden" style={{ gap: u(6) }}>
            {reqs.map(([t, m]) => (
              <span key={t} data-motion className="flex items-center" style={{ height: u(30), gap: u(6), paddingInline: u(10), borderRadius: u(12), background: m ? blocks.sage : "#262626", color: m ? ink : ground.muted, fontSize: u(12.5), fontWeight: 600, transition: "background-color .25s, color .25s" }}>
                <svg aria-hidden viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ width: u(14), height: u(14), flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.4" style={{ opacity: m ? 0 : 0.6, transition: "opacity .2s" }} />
                  <path data-motion d="M5 12.5l4.5 4.5L19 7" stroke={ink} strokeWidth="3.4" pathLength={1} strokeDasharray={1} strokeDashoffset={m ? 0 : 1} style={{ transition: `stroke-dashoffset .35s ${ease} ${m ? "80ms" : "0ms"}` }} />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: u(6) }}>
          <Field label="Confirm password" dots={10} error={s.error} />
          <div data-motion className="grid" style={{ gridTemplateRows: s.error ? "1fr" : "0fr", transition: `grid-template-rows .4s ${ease}` }}>
            <div className="min-h-0 overflow-hidden">
              <span data-motion className="inline-flex items-center rounded-full" style={{ marginTop: u(8), gap: u(5), paddingInline: u(12), height: u(26), background: blocks.tangerine, color: ink, fontSize: u(12.5), fontWeight: 600, opacity: s.error ? 1 : 0, transform: s.error ? "none" : `translateY(${u(-6)})`, transition: "opacity .3s, transform .3s" }}>
                <Glyph name="bang" size={12} stroke={3.2} />Passwords do not match
              </span>
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}
