"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";

/*
 * Sheets: Toast, Confirm Sheet, Permission Sheet.
 * Each preview shows the component and nothing else. The sheets keep only their own dimmed backdrop,
 * which is what makes them read as presented; there is no app screen behind them.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.35, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const quiet = "#2a2a2a";

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

/** Steps through named phases with per-phase durations and loops. Holds `rest` under reduced motion. */
function usePhases<P extends string>(script: readonly (readonly [P, number])[], rest: P) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setI((v) => (v + 1) % script.length), script[i][1]);
    return () => clearTimeout(t);
  }, [i, script, reduced]);
  return { phase: reduced ? rest : script[i][0], cycle: i, reduced };
}

const G = {
  check: "M5 12.5l4.5 4.5L19 7",
  info: "M12 11v6M12 7.2v.1",
  trash: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7",
  bell: "M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14l1.5-2ZM10 21h4",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
  people: "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11ZM3.5 19.5a5.5 5.5 0 0 1 11 0M16 5a3.2 3.2 0 0 1 0 6M20.5 19.5a5.5 5.5 0 0 0-3.5-5.1",
  moon: "M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z",
} as const;

function Glyph({ d, size, stroke = 2.4, style }: { d: string; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}>
      <path d={d} />
    </svg>
  );
}

function Ground({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>{children}</div>;
}


const Spinner = ({ shown, color }: { shown: boolean; color: string }) => (
  <span data-motion className="absolute rounded-full" style={{ width: u(18), height: u(18), borderWidth: u(2.4), borderStyle: "solid", borderColor: `${color}40`, borderTopColor: color, animation: "sh-spin .8s linear infinite", opacity: shown ? 1 : 0, transition: "opacity .2s" }} />
);

/** Swaps between two children with a crossfade, like `.contentTransition(.symbolEffect(.replace))`. */
function Swap({ first, second, showSecond }: { first: ReactNode; second: ReactNode; showSecond: boolean }) {
  const layer = (on: boolean): CSSProperties => ({ gridArea: "1 / 1", display: "flex", opacity: on ? 1 : 0, transform: on ? "none" : "scale(0.5)", transition: `opacity .25s, transform .4s ${spring}` });
  return (
    <span className="grid place-items-center">
      <span data-motion style={layer(!showSecond)}>{first}</span>
      <span data-motion style={layer(showSecond)}>{second}</span>
    </span>
  );
}

const keyframes = `@keyframes sh-spin{to{transform:rotate(360deg)}}@keyframes sh-bounce{0%{transform:translateY(0)}35%{transform:translateY(${u(4)}) scale(1.08)}100%{transform:none}}@keyframes sh-rise{from{opacity:0;transform:translateY(${u(14)})}to{opacity:1;transform:none}}`;

// MARK: Toast

type ToastPhase = "rest" | "arm" | "shown" | "touched" | "resume" | "undo" | "gone";
// The empty stretches stay short: a card tile should almost always show the toast, not a blank stage.
const toastScript: readonly (readonly [ToastPhase, number])[] = [["rest", 420], ["arm", 160], ["shown", 1500], ["touched", 900], ["resume", 900], ["undo", 520], ["gone", 520]];

export function ToastPreview() {
  const { phase } = usePhases(toastScript, "shown");
  const shown = phase === "shown" || phase === "touched" || phase === "resume" || phase === "undo";
  // The timer drains while shown or resumed and holds while touched, like the Swift `TimelineView`.
  const [left, setLeft] = useState(1);
  const clock = useRef({ used: 0, since: 0 });
  useEffect(() => {
    if (phase === "arm" || phase === "rest") { clock.current = { used: 0, since: performance.now() }; setLeft(1); return; }
    if (phase === "touched" || phase === "undo" || phase === "gone") { clock.current.used += performance.now() - clock.current.since; return; }
    clock.current.since = performance.now();
    let raf = 0;
    const tick = () => { setLeft(Math.max(0, 1 - (clock.current.used + performance.now() - clock.current.since) / 4200)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  return (
    <Ground>
      <style>{keyframes}</style>
      <div data-motion className="absolute inset-x-0 flex justify-center" style={{ top: "50%", paddingInline: u(28), opacity: shown ? 1 : 0, transform: shown ? `translateY(-50%) scale(${phase === "touched" ? 0.97 : 1})` : `translateY(calc(-50% - ${u(64)})) scale(0.92)`, transformOrigin: "top", transition: `transform .55s ${spring}, opacity .3s` }}>
        <div className="relative flex w-full items-center" style={{ maxWidth: u(476), gap: u(14), padding: u(12), borderRadius: u(24), background: "#2a2a2a", boxShadow: `0 ${u(12)} ${u(28)} rgba(0,0,0,.45)` }}>
          <span key={shown ? "in" : "out"} data-motion className="flex items-center justify-center" style={{ width: u(46), height: u(46), borderRadius: u(14), background: blocks.sage, color: ink, animation: shown ? `sh-bounce .5s ${spring} .15s both` : undefined }}><Glyph d={G.check} size={23} stroke={3} /></span>
          <span className="min-w-0 flex-1">
            <span className="block" style={{ fontSize: u(17), fontWeight: 600 }}>Conversation archived</span>
            <span className="block truncate" style={{ fontSize: u(14), color: ground.muted }}>Mira Reyes · Invoice 2291</span>
          </span>
          <span className="relative flex items-center justify-center" style={{ minWidth: u(76), height: u(46), borderRadius: u(23), paddingInline: u(18), background: signal.fill, color: signal.on, fontSize: u(16), fontWeight: 700, transform: `scale(${phase === "undo" ? 0.96 : 1})`, transition: `transform .2s` }}>
            <Swap first={<span>Undo</span>} second={<Glyph d={G.check} size={18} stroke={3.4} />} showSecond={phase === "undo"} />
          </span>
          <span data-motion className="absolute rounded-full" style={{ left: u(26), bottom: u(6), height: u(2), width: `calc(${left} * (100% - ${u(52)}))`, background: "rgba(244,243,239,.28)" }} />
        </div>
      </div>
    </Ground>
  );
}

// MARK: Confirm Sheet

type ConfirmPhase = "rest" | "present" | "idle" | "press" | "busy" | "done" | "leave" | "drag" | "flick";
const confirmScript: readonly (readonly [ConfirmPhase, number])[] = [
  ["rest", 900], ["present", 500], ["idle", 1200], ["press", 150], ["busy", 900], ["done", 650], ["leave", 700], ["rest", 700],
  ["present", 500], ["idle", 1100], ["drag", 380], ["flick", 700],
];

export function ConfirmSheetPreview() {
  const { phase, cycle } = usePhases(confirmScript, "idle");
  const up = phase === "present" || phase === "idle" || phase === "press" || phase === "busy" || phase === "done" || phase === "drag";
  const busy = phase === "busy" || phase === "done", done = phase === "done";
  const offset = up ? (phase === "drag" ? 34 : 0) : 430;
  return (
    <Ground>
      <style>{keyframes}</style>
      <div data-motion className="absolute inset-0" style={{ background: "rgba(0,0,0,.45)", opacity: up ? 1 : 0, transition: "opacity .35s" }} />

      <div data-motion className="absolute inset-x-0 flex justify-center" style={{ bottom: u(28), paddingInline: u(10), transform: `translateY(${u(offset)})`, transition: phase === "drag" ? `transform .35s ${ease}` : `transform .55s ${spring}` }}>
        <div className="flex w-full flex-col" style={{ maxWidth: u(476), padding: `${u(12)} ${u(24)} ${u(22)}`, borderRadius: u(34), background: ground.surface, boxShadow: `0 ${u(14)} ${u(34)} rgba(0,0,0,.5)` }}>
          <span className="self-center rounded-full" style={{ width: u(38), height: u(5), background: quiet }} />
          <span key={up ? `t${cycle}` : "down"} data-motion className="flex items-center justify-center" style={{ marginTop: u(14), width: u(56), height: u(56), borderRadius: u(18), background: done ? blocks.sage : blocks.tangerine, color: ink, transition: "background-color .3s", animation: phase === "present" ? `sh-bounce .5s ${spring} .2s both` : undefined }}>
            <Swap first={<Glyph d={G.trash} size={24} stroke={2.4} />} second={<Glyph d={G.check} size={24} stroke={3.2} />} showSecond={done} />
          </span>
          <p style={{ fontSize: u(26), fontWeight: font.displayWeight, letterSpacing: "-0.03em", marginTop: u(16), lineHeight: 1.1 }}>Delete this note?</p>
          <p style={{ fontSize: u(15), color: ground.muted, marginTop: u(6), lineHeight: 1.35 }}>It will be removed from your iPhone, iPad and Mac.</p>
          <span className="relative flex items-center justify-center" style={{ marginTop: u(20), height: u(52), borderRadius: u(18), background: signal.fill, color: signal.on, fontSize: u(17), fontWeight: 600, transform: `scale(${phase === "press" ? 0.97 : 1})`, transition: `transform .25s ${spring}` }}>
            <span data-motion style={{ opacity: busy ? 0 : 1, transition: "opacity .2s" }}>Delete note</span>
            <Spinner shown={phase === "busy"} color={ink} />
            <span data-motion className="absolute flex" style={{ opacity: done ? 1 : 0, transform: done ? "none" : "scale(0.5)", transition: `opacity .2s, transform .35s ${spring}` }}><Glyph d={G.check} size={19} stroke={3.4} /></span>
          </span>
          <span className="flex items-center justify-center" style={{ marginTop: u(9), height: u(52), borderRadius: u(18), background: quiet, fontSize: u(17), fontWeight: 600, opacity: busy ? 0.5 : 1, transition: "opacity .2s" }}>Cancel</span>
        </div>
      </div>
    </Ground>
  );
}

// MARK: Permission Sheet

type PermissionPhase = "rest" | "present" | "idle" | "press" | "requesting" | "result" | "hold" | "leave";
const permissionScript: readonly (readonly [PermissionPhase, number])[] = [
  ["rest", 700], ["present", 600], ["idle", 1300], ["press", 150], ["requesting", 900], ["result", 700], ["hold", 1300], ["leave", 600],
];

export function PermissionSheetPreview() {
  const { phase, reduced } = usePhases(permissionScript, "idle");
  const [round, setRound] = useState(0);
  useEffect(() => { if (phase === "rest") setRound((r) => r + 1); }, [phase]);
  const up = phase !== "rest" && phase !== "leave";
  const decided = phase === "result" || phase === "hold";
  const granted = decided && round % 2 === 1, denied = decided && round % 2 === 0;
  const busy = phase === "requesting";
  const benefits = [[G.clock, "A nudge 30 minutes before things are due", blocks.butter], [G.people, "Replies from people you share lists with", blocks.lilac]] as const;
  const copy = (on: boolean): CSSProperties => ({ gridArea: "1 / 1", opacity: on ? 1 : 0, filter: on || reduced ? "none" : `blur(${u(5)})`, transition: "opacity .35s, filter .35s" });
  const tileFill = granted ? blocks.sage : denied ? blocks.sand : blocks.sky;
  const buttonFill = granted ? blocks.sage : denied ? ground.text : signal.fill;
  return (
    <Ground>
      <style>{keyframes}</style>
      <div data-motion className="absolute inset-0" style={{ background: "rgba(0,0,0,.45)", opacity: up ? 1 : 0, transition: "opacity .35s" }} />

      <div data-motion className="absolute inset-x-0 bottom-0 flex justify-center" style={{ top: u(18), transform: up ? "none" : "translateY(105%)", transition: `transform .6s ${up ? spring : ease}` }}>
        <div key={round} className="flex w-full flex-col" style={{ maxWidth: u(470), padding: `${u(18)} ${u(24)} ${u(48)}`, borderRadius: `${u(34)} ${u(34)} 0 0`, background: ground.surface }}>
          <span data-motion className="flex items-center justify-center" style={{ width: u(50), height: u(50), borderRadius: u(16), background: tileFill, color: ink, transform: granted ? "scale(1.06)" : "none", transition: `background-color .3s, transform .45s ${spring}`, animation: `sh-bounce .5s ${spring} .25s both` }}>
            <span className="grid place-items-center">
              <Swap first={<Glyph d={G.bell} size={24} stroke={2.4} />} second={granted ? <Glyph d={G.check} size={24} stroke={3.2} /> : <Glyph d={G.gear} size={24} stroke={2.4} />} showSecond={decided} />
            </span>
          </span>
          <div className="grid" style={{ marginTop: u(12) }}>
            <div data-motion style={copy(!denied)}>
              <p style={{ fontSize: u(24), fontWeight: font.displayWeight, letterSpacing: "-0.035em", lineHeight: 1.1 }}>Turn on notifications</p>
              <p style={{ fontSize: u(14), color: ground.muted, marginTop: u(5), lineHeight: 1.35 }}>We only send what matters, and you can change this any time.</p>
            </div>
            <div data-motion style={copy(denied)}>
              <p style={{ fontSize: u(24), fontWeight: font.displayWeight, letterSpacing: "-0.035em", lineHeight: 1.1 }}>Notifications are off</p>
              <p style={{ fontSize: u(14), color: ground.muted, marginTop: u(5), lineHeight: 1.35 }}>Turn them on in Settings whenever you&apos;re ready.</p>
            </div>
          </div>
          <div data-motion className="flex flex-col overflow-hidden" style={{ gap: u(6), marginTop: denied ? 0 : u(12), maxHeight: denied ? 0 : u(90), opacity: denied ? 0 : 1, transition: `max-height .45s ${ease}, opacity .3s, margin .45s ${ease}` }}>
            {benefits.map(([d, text, color], i) => (
              <div key={text} data-motion className="flex items-center" style={{ gap: u(12), animation: `sh-rise .5s ${spring} ${150 + i * 80}ms both` }}>
                <span className="flex shrink-0 items-center justify-center" style={{ width: u(36), height: u(36), borderRadius: u(12), background: color, color: ink }}><Glyph d={d} size={17} stroke={2.4} /></span>
                <span style={{ fontSize: u(14.5), fontWeight: 500, lineHeight: 1.25 }}>{text}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center" style={{ gap: u(8) }}>
            <span className="relative flex flex-1 items-center justify-center" style={{ height: u(50), borderRadius: u(16), gap: u(8), background: buttonFill, color: denied ? ground.bg : ink, fontSize: u(16), fontWeight: 600, transform: `scale(${phase === "press" ? 0.97 : 1})`, transition: `transform .25s ${spring}, background-color .3s, color .3s` }}>
              <span data-motion className="flex items-center" style={{ gap: u(7), opacity: busy ? 0 : 1, transition: "opacity .2s" }}>
                {granted ? <Glyph d={G.check} size={17} stroke={3.4} /> : null}
                {granted ? "Allowed" : denied ? "Open Settings" : "Allow notifications"}
              </span>
              <Spinner shown={busy} color={ink} />
            </span>
            <span className="flex items-center justify-center" style={{ height: u(50), paddingInline: u(18), borderRadius: u(16), background: quiet, fontSize: u(15), fontWeight: 600, color: ground.text, opacity: granted ? 0.4 : 1, transition: "opacity .25s" }}>Not now</span>
          </div>
        </div>
      </div>
    </Ground>
  );
}
