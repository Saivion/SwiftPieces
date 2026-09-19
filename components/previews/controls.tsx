"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";

/*
 * Controls previews. Each piece is shown on its own, centered on the house ground, with nothing around
 * it: no card, no headings, no invented app UI. Sizes are container units against a 460 px wide stage,
 * so the 330 px grid card and the docs header show the same thing. Rest state first, then the loop.
 */

const spring = "cubic-bezier(0.34, 1.3, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Stage-relative size: `n` px on a 460 px wide stage. */
const u = (n: number) => `${(n / 4.6).toFixed(3)}cqw`;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const raised = ground.raised;

/** Walks a scripted sequence of states; each step holds for `ms`, then loops. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms); return () => clearTimeout(t); }, [i, steps]);
  return steps[i];
}

const glyphs: Record<string, string> = {
  arrow: "M5 12h14M13 6l6 6-6 6", plus: "M12 5v14M5 12h14", check: "M5 12.5l4.5 4.5L19 7",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3", bang: "M12 6v8M12 18.2v.1",
};
function Glyph({ name, size, width = 2.4, style }: { name: string; size: number; width?: number; style?: CSSProperties }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}><path d={glyphs[name]} /></svg>;
}

/** The house ground with the component centered on it. Nothing else lives here. */
function Stage({ children, width }: { children: ReactNode; width?: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>
      <div className="relative flex flex-col items-center" style={{ width: width ? u(width) : undefined }}>{children}</div>
    </div>
  );
}

/** A finger: a soft disc that fades in where the scripted touch lands. */
const Touch = ({ show, x, y }: { show: boolean; x: string; y: string }) => (
  <span aria-hidden data-motion className="pointer-events-none absolute rounded-full" style={{ left: x, top: y, width: u(40), height: u(40), marginLeft: u(-20), marginTop: u(-20), background: "radial-gradient(circle at 40% 36%, rgba(255,255,255,.55), rgba(255,255,255,.18) 64%)", opacity: show ? 1 : 0, transition: `opacity .2s ${ease}`, zIndex: 20 }} />
);

/* ─── Elastic Button ───────────────────────────────────────────────────────────────────────────
   The style itself. The signal button squashes toward the finger, darkens, flattens its shadow,
   deepens on hold and stretches on drag; then the lilac block does the same, springier. */

const elasticSteps = [
  { b: -1, p: "idle", ms: 1400 },
  { b: 0, p: "press", ms: 360 }, { b: 0, p: "deep", ms: 460 }, { b: 0, p: "drag", ms: 420 }, { b: 0, p: "idle", ms: 1300 },
  { b: 1, p: "press", ms: 360 }, { b: 1, p: "deep", ms: 420 }, { b: 1, p: "idle", ms: 1500 },
] as const;
const elasticShape: Record<string, { transform: string; transition: string; dark: number; lift: boolean }> = {
  idle: { transform: "none", transition: `transform .45s ${spring}`, dark: 0, lift: true },
  press: { transform: "scale(0.96)", transition: "transform .16s ease-out", dark: 0.09, lift: false },
  deep: { transform: "scale(0.93)", transition: "transform .35s ease-out", dark: 0.16, lift: false },
  drag: { transform: `translate(${u(9)}, ${u(1)}) scale(1.02, 0.9)`, transition: "transform .15s ease-out", dark: 0.16, lift: false },
};

function ElasticSurface({ active, fill, children, disabled }: { active?: string; fill: string; children: ReactNode; disabled?: boolean }) {
  const s = elasticShape[active ?? "idle"];
  return (
    <div data-motion className="relative flex flex-1 items-center justify-center rounded-full" style={{
      height: u(58), gap: u(9), fontSize: u(17), fontWeight: 600,
      background: disabled ? raised : fill, color: disabled ? ground.muted : ink,
      transform: s.transform, transformOrigin: "62% 60%", transition: `${s.transition}, box-shadow .25s ${ease}`,
      boxShadow: disabled ? "none" : s.lift ? `0 ${u(9)} ${u(20)} rgba(0,0,0,.45), 0 ${u(1)} ${u(1)} rgba(0,0,0,.25)` : `0 ${u(1)} ${u(3)} rgba(0,0,0,.3)`,
    }}>
      <span data-motion className="absolute inset-0 rounded-full" style={{ background: ink, opacity: s.dark, transition: "opacity .2s" }} />
      <span className="relative flex items-center" style={{ gap: u(9) }}>{children}</span>
    </div>
  );
}

export function ElasticButtonPreview() {
  const step = useSteps(elasticSteps);
  const on = (i: number) => (step.b === i ? step.p : undefined);
  return (
    <Stage width={382}>
      <div className="relative flex w-full flex-col" style={{ gap: u(13) }}>
        <div className="relative flex">
          <ElasticSurface active={on(0)} fill={signal.fill}>Reserve table<Glyph name="arrow" size={18} /></ElasticSurface>
          <Touch show={step.b === 0 && step.p !== "idle"} x={step.p === "drag" ? "70%" : "64%"} y="58%" />
        </div>
        <div className="relative flex" style={{ gap: u(13) }}>
          <ElasticSurface active={on(1)} fill={blocks.lilac}><Glyph name="plus" size={17} />Add guest</ElasticSurface>
          <ElasticSurface fill={raised} disabled>Waitlist</ElasticSurface>
          <Touch show={step.b === 1 && step.p !== "idle"} x="30%" y="56%" />
        </div>
      </div>
    </Stage>
  );
}

/* ─── Commit Button ────────────────────────────────────────────────────────────────────────────
   The button alone. Save collapses to a spinning ring, closes it, turns sage and blooms into
   "Saved"; the next attempt fails as a butter block that rolls to the message and shakes. */

const commitSteps = [
  { p: "idle", ms: 1500 }, { p: "press", ms: 170 }, { p: "loading", ms: 1300 }, { p: "closed", ms: 320 }, { p: "check", ms: 380 }, { p: "saved", ms: 1500 },
  { p: "idle", ms: 1300 }, { p: "press", ms: 170 }, { p: "loading", ms: 1200 }, { p: "error", ms: 2000 },
] as const;

export function CommitButtonPreview() {
  const { p } = useSteps(commitSteps);
  const ref = useRef<HTMLDivElement>(null);
  const collapsed = p === "loading" || p === "closed" || p === "check";
  const success = p === "closed" || p === "check" || p === "saved";
  const fill = p === "error" ? blocks.butter : success ? blocks.sage : signal.fill;
  const width = collapsed ? 76 : p === "saved" ? 206 : p === "error" ? 272 : 306;
  useEffect(() => {
    if (p !== "error" || !ref.current || reduced()) return;
    const a = ref.current.animate([-10, 9, -6, 5, -2, 0].map((x) => ({ transform: `translateX(${u(x)})` })), { duration: 360, delay: 140, easing: "ease-in-out" });
    return () => a.cancel();
  }, [p]);
  const C = 2 * Math.PI * 10;
  return (
    <Stage>
      <div ref={ref} data-motion className="relative flex items-center justify-center overflow-hidden rounded-full" style={{
        height: u(72), width: u(width), background: fill, color: ink, fontSize: u(21), fontWeight: 600,
        transform: p === "press" ? "scale(0.96)" : "none",
        transition: `width .38s ${spring}, background-color .3s ${ease}, transform ${p === "press" ? ".16s ease-out" : `.36s ${spring}`}`,
      }}>
        <span data-motion className="absolute inset-0" style={{ background: ink, opacity: p === "press" ? 0.1 : 0, transition: "opacity .15s" }} />
        {collapsed ? (
          <svg viewBox="0 0 26 26" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" data-motion style={{ width: u(34), height: u(34), animation: `pop .3s ${spring} both` }} aria-hidden>
            <circle cx="13" cy="13" r="10" stroke={ink} opacity=".22" />
            <circle data-motion cx="13" cy="13" r="10" stroke={ink} strokeDasharray={C} strokeDashoffset={p === "loading" ? C * 0.72 : 0} style={{ transformOrigin: "center", animation: p === "loading" ? "spin-slow 1s linear infinite" : "none", transition: "stroke-dashoffset .4s ease-out" }} />
            <path data-motion d="M8.4 13.6l3.2 3.2 6-6.6" stroke={ink} pathLength={1} strokeDasharray={1} strokeDashoffset={p === "check" ? 0 : 1} style={{ transition: `stroke-dashoffset .35s ${spring}` }} />
          </svg>
        ) : (
          <span key={p === "error" ? "e" : p === "saved" ? "s" : "i"} data-motion className="relative flex items-center whitespace-nowrap" style={{ gap: u(12), animation: `rise .3s ${ease} both` }}>
            {p === "saved" ? <span className="grid place-items-center rounded-full" style={{ width: u(31), height: u(31), background: ink, color: blocks.sage }}><Glyph name="check" size={18} width={3} /></span> : null}
            {p === "error" ? <span className="grid place-items-center rounded-full" style={{ width: u(29), height: u(29), background: ink, color: blocks.butter }}><Glyph name="bang" size={18} width={3.2} /></span> : null}
            {p === "error" ? "Couldn't save" : p === "saved" ? "Saved" : "Save changes"}
          </span>
        )}
      </div>
    </Stage>
  );
}

/* ─── Hold To Confirm ──────────────────────────────────────────────────────────────────────────
   The capsule alone. A short hold rewinds with a spring; a full hold sweeps signal past three
   milestone dots (each pops with its haptic) and settles into a sage "Deleted" block. */

const holdSteps = [
  { p: "idle", ms: 1300 }, { p: "short", ms: 560 }, { p: "cancel", ms: 900 },
  { p: "hold", ms: 1250 }, { p: "done", ms: 1700 }, { p: "reset", ms: 500 },
] as const;

const HOLD_H = 64, PUCK = 54;

function HoldCapsule({ title, icon, state, fill, done, disabled }: { title: string; icon: string; state: string; fill: string; done?: string; disabled?: boolean }) {
  const committed = state === "done";
  const pct = state === "hold" || committed ? 100 : state === "short" ? 34 : 0;
  const transition = state === "hold" ? "1.2s linear" : state === "short" ? ".5s linear" : state === "cancel" ? `.55s ${spring}` : committed ? "0s" : ".35s ease-out";
  // The fill starts under the puck (one capsule height), then sweeps the rest.
  const w = pct === 0 && !committed ? "0px" : `calc(${u(HOLD_H)} + (100% - ${u(HOLD_H)}) * ${pct / 100})`;
  const passed = (i: number) => (state === "hold" || state === "short") && pct >= i * 25;
  const tone = committed ? blocks.sage : fill;
  const label = (on: boolean) => (
    <span className="absolute inset-0 flex items-center" style={{ color: on ? ink : ground.text }}>
      <span data-motion className="grid shrink-0 place-items-center rounded-full" style={{ width: u(PUCK), height: u(PUCK), marginLeft: u(5), background: on ? ink : ground.text, color: on ? tone : raised, transition: "background-color .3s" }}>
        <Glyph name={committed ? "check" : icon} size={22} width={2.4} />
      </span>
      <span key={committed ? "d" : "t"} data-motion className="flex-1 text-center" style={{ paddingRight: u(PUCK + 5), fontSize: u(18), fontWeight: 600, animation: `rise .3s ${ease} both` }}>{committed ? done : title}</span>
    </span>
  );
  return (
    <div data-motion className="relative w-full overflow-hidden rounded-full" style={{ height: u(HOLD_H), background: raised, opacity: disabled ? 0.5 : 1, filter: disabled ? "saturate(0)" : "none", transform: state === "hold" || state === "short" ? "scale(0.98)" : "none", transition: `transform .3s ${spring}` }}>
      <span data-motion className="absolute inset-y-0 left-0 rounded-full" style={{ width: w, background: tone, transition: `width ${transition}, background-color .35s ${ease}` }} />
      {label(false)}
      <span data-motion className="absolute inset-0" style={{ clipPath: `inset(0 calc(100% - ${w}) 0 0 round 999px)`, transition: `clip-path ${transition}` }}>{label(true)}</span>
      {!committed && [1, 2, 3].map((i) => (
        <span key={i} data-motion className="absolute rounded-full" style={{ left: `calc(${u(HOLD_H)} + (100% - ${u(HOLD_H)}) * ${i / 4})`, bottom: u(8), width: u(6), height: u(6), marginLeft: u(-3), background: passed(i) ? "rgba(20,20,20,.6)" : "rgba(244,243,239,.28)", transform: passed(i) ? "scale(1.6)" : "scale(1)", transition: `transform .3s ${spring} ${i * 300}ms, background-color .1s ${i * 300}ms` }} />
      ))}
    </div>
  );
}

export function HoldToConfirmPreview() {
  const { p } = useSteps(holdSteps);
  const state = p === "reset" ? "idle" : p;
  return (
    <Stage width={382}>
      <div className="relative flex w-full flex-col" style={{ gap: u(13) }}>
        <div className="relative">
          <HoldCapsule title="Hold to delete" icon="trash" state={state} fill={signal.fill} done="Deleted" />
          <Touch show={p === "short" || p === "hold"} x={u(34)} y="62%" />
        </div>
        <HoldCapsule title="Hold to transfer" icon="arrow" state="idle" fill={blocks.butter} disabled />
      </div>
    </Stage>
  );
}

/* ─── Fan Stack ────────────────────────────────────────────────────────────────────────────────
   The stack alone. The block avatars fan open with a stagger as the +3 pill dissolves, and a finger
   scrubs across them: each lifts under its name tag, and releasing selects that person. */

const people = ["Priya Raman", "Jonas Weber", "Amara Diallo", "Leo Brandt", "Sofia Marin", "Kenji Sato"];
const faces = [blocks.tangerine, blocks.sky, blocks.butter, blocks.sage, blocks.lilac, blocks.sand];
const fanSteps = [
  { open: false, hover: -1, ms: 1600 }, { open: true, hover: -1, ms: 800 },
  { open: true, hover: 0, ms: 380 }, { open: true, hover: 1, ms: 380 }, { open: true, hover: 2, ms: 700 },
  { open: false, hover: -1, ms: 2200 }, { open: true, hover: -1, ms: 700 }, { open: true, hover: 4, ms: 380 },
  { open: true, hover: 5, ms: 380 }, { open: true, hover: 0, ms: 700 }, { open: false, hover: -1, ms: 600 },
] as const;

export function FanStackPreview() {
  const { open, hover } = useSteps(fanSteps);
  const size = 58, gap = 12, shown = 3, overlap = 0.25;
  const step = open ? size + gap : size * (1 - overlap);
  const x = (i: number) => (open ? i : Math.min(i, shown)) * step;
  const delay = (i: number) => `${(open ? i : people.length - 1 - i) * 35}ms`;
  const width = (people.length - 1) * (size + gap) + size;
  return (
    <Stage width={width}>
      <div className="relative w-full" style={{ height: u(size + 26) }}>
        {people.map((name, i) => {
          const hidden = !open && i >= shown, lifted = open && hover === i;
          return (
            <div key={name} data-motion className="absolute top-0" style={{ left: u(x(i)), zIndex: lifted ? 10 : people.length - i, transition: `left .45s ${spring} ${delay(i)}` }}>
              <span data-motion className="grid place-items-center rounded-full" style={{
                width: u(size), height: u(size), background: faces[i], color: ink, fontFamily: font.rounded, fontSize: u(21), fontWeight: 700,
                boxShadow: `0 0 0 ${u(3)} ${ground.bg}${lifted ? `, 0 ${u(7)} ${u(16)} rgba(0,0,0,.5)` : ""}`,
                transform: hidden ? "scale(0.6)" : lifted ? `translateY(${u(-5)}) scale(1.18)` : "none", opacity: hidden ? 0 : 1,
                transition: `transform .3s ${spring} ${lifted || hover >= 0 ? "0ms" : delay(i)}, opacity .3s ${delay(i)}, box-shadow .25s`,
              }}>{name.split(" ").map((w) => w[0]).join("")}</span>
              <span data-motion className="absolute left-1/2 whitespace-nowrap" style={{ top: u(size + 9), transform: "translateX(-50%)", fontSize: u(14), fontWeight: lifted ? 700 : 500, color: lifted ? ground.text : ground.muted, opacity: open ? 1 : 0, transition: "opacity .3s" }}>{name.split(" ")[0]}</span>
              <span data-motion className="absolute left-1/2 flex items-center whitespace-nowrap rounded-full" style={{ bottom: u(size + 12), height: u(30), paddingInline: u(12), background: ground.text, color: ground.bg, fontSize: u(14), fontWeight: 600, transform: `translateX(-50%) scale(${lifted ? 1 : 0.6})`, transformOrigin: "bottom center", opacity: lifted ? 1 : 0, transition: `transform .28s ${spring}, opacity .18s` }}>{name}</span>
            </div>
          );
        })}
        <span data-motion className="absolute top-0 grid place-items-center rounded-full tabular-nums" style={{
          width: u(size), height: u(size), background: raised, color: ground.text, fontFamily: font.rounded, fontSize: u(20), fontWeight: 700, boxShadow: `0 0 0 ${u(3)} ${ground.bg}`,
          left: u(open ? x(shown) : shown * step), transform: open ? "scale(0.6)" : "none", opacity: open ? 0 : 1,
          transition: `left .45s ${spring} ${delay(shown)}, transform .45s ${spring} ${delay(shown)}, opacity .3s ${delay(shown)}`,
        }}>+{people.length - shown}</span>
        <Touch show={open && hover >= 0} x={u(x(Math.max(hover, 0)) + size / 2)} y={u(size + 4)} />
      </div>
    </Stage>
  );
}

/* ─── Timer Dial ───────────────────────────────────────────────────────────────────────────────
   The dial alone. The knob winds it from 45 down to 10 in detents, it runs into the signal warning
   zone where it breathes, and it finishes as a full sage ring. Below, the same ring in progress mode. */

function Dial({ side, lw, fraction, color, knob, ticks, finished, children, breathe = 1 }: { side: number; lw: number; fraction: number; color: string; knob: boolean; ticks: boolean; finished?: boolean; children: ReactNode; breathe?: number }) {
  const r = (side - lw) / 2, C = 2 * Math.PI * r, c = side / 2, tr = side / 2 - lw - 8;
  return (
    <div className="relative shrink-0" style={{ width: u(side), height: u(side) }}>
      <svg viewBox={`0 0 ${side} ${side}`} className="absolute inset-0 overflow-visible" style={{ width: "100%", height: "100%", transform: `scale(${breathe})` }} aria-hidden>
        {ticks && Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2, major = i % 5 === 0, len = major ? 9 : 5;
          const lit = i / 60 < (finished ? 1 : fraction);
          return <line key={i} x1={c + Math.cos(a) * tr} y1={c + Math.sin(a) * tr} x2={c + Math.cos(a) * (tr - len)} y2={c + Math.sin(a) * (tr - len)} stroke={ground.muted} strokeOpacity={lit ? 0.75 : 0.25} strokeWidth={major ? 2.4 : 1.4} strokeLinecap="round" />;
        })}
        <circle cx={c} cy={c} r={r} fill="none" stroke={raised} strokeWidth={lw} />
        <circle data-motion cx={c} cy={c} r={r} fill="none" stroke={finished ? blocks.sage : color} strokeWidth={lw} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (finished ? 1 : fraction))} transform={`rotate(-90 ${c} ${c})`} style={{ transition: `stroke .5s ${ease}, stroke-dashoffset ${finished ? `.5s ${spring}` : ".12s linear"}` }} />
        <g data-motion style={{ transform: `rotate(${fraction * 360}deg)`, transformOrigin: `${c}px ${c}px`, transition: "transform .12s linear" }}>
          <circle data-motion cx={c} cy={lw / 2} r={(lw + (knob ? 10 : 4)) / 2} fill={ground.text} style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.45))", transform: finished || fraction < 0.005 ? "scale(0)" : "scale(1)", transformBox: "fill-box", transformOrigin: "center", transition: `transform .35s ${spring}` }} />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

const TOTAL = 10, WIND = 1600, WIND_END = WIND + 7 * 140, START = WIND_END + 700, FINISH = START + TOTAL * 1000, LOOP = FINISH + 2400;
const DIAL = 214, RING = 80;

export function TimerDialPreview() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let id = 0; const t0 = performance.now();
    const tick = () => { setNow(Math.max(0, performance.now() - t0) % LOOP); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id);
  }, []);
  const winding = now >= WIND && now < WIND_END;
  const set = now < WIND ? 45 : now < WIND_END ? 45 - 5 * Math.floor((now - WIND) / 140 + 1) : TOTAL;
  const running = now >= START && now < FINISH, finished = now >= FINISH;
  const remaining = finished ? 0 : running ? TOTAL - (now - START) / 1000 : set;
  const shown = Math.ceil(remaining), warning = running && shown <= 5;
  const fraction = running || finished ? remaining / TOTAL : set / 60;
  const breathe = warning && !reduced() ? 1 + 0.012 * Math.sin((now / 1000) * 2 * Math.PI) : 1;
  const caption = finished ? "DONE" : running ? "REMAINING" : "READY";
  return (
    <Stage>
      <div className="relative flex flex-col items-center" style={{ gap: u(16) }}>
        <Dial side={DIAL} lw={19} fraction={fraction} color={warning ? signal.fill : blocks.tangerine} knob={!running} ticks finished={finished} breathe={breathe}>
          <span className="tabular-nums" style={{ fontSize: u(60), fontWeight: font.numeralWeight, letterSpacing: "-0.03em", lineHeight: 1 }}>
            <span style={{ color: ground.muted, opacity: 0.6 }}>0:</span>
            <span style={{ color: warning ? signal.fill : ground.text, transition: "color .3s" }}>{String(shown).padStart(2, "0")}</span>
          </span>
          <span style={{ marginTop: u(6), fontSize: u(12), fontWeight: 600, letterSpacing: "0.1em", color: ground.muted }}>{caption}</span>
        </Dial>
        <Touch show={winding} x={u(DIAL / 2 + Math.sin(fraction * Math.PI * 2) * (DIAL / 2 - 9.5))} y={u(DIAL / 2 - Math.cos(fraction * Math.PI * 2) * (DIAL / 2 - 9.5))} />
        <Dial side={RING} lw={9} fraction={0.72} color={blocks.sky} knob={false} ticks={false}>
          <span className="tabular-nums" style={{ fontSize: u(19), fontWeight: font.numeralWeight, lineHeight: 1 }}>72<span style={{ color: ground.muted, opacity: 0.6 }}>%</span></span>
          <span style={{ marginTop: u(3), fontSize: u(7), fontWeight: 600, letterSpacing: "0.1em", color: ground.muted }}>UPLOADED</span>
        </Dial>
      </div>
    </Stage>
  );
}
