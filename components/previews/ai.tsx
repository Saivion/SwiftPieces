"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Center } from "./frame";
import { blocks, font, ground, ink } from "./palette";
import { SIRI, SiriWaveOrb, type OrbPalette } from "./siri-wave-orb";

const springEase = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

/** iOS points to container units. `s` is cqw per point for the vignette. */
const pt = (n: number, s: number) => `${+(n * s).toFixed(3)}cqw`;

const Icon = ({ d, size, stroke = 2.2, style }: { d: string; size: string; stroke?: number; style?: CSSProperties }) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0, ...style }} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
/** SF `sparkle`: one four-point star. */
const Sparkle = ({ size, style }: { size: string; style?: CSSProperties }) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0, ...style }} fill="currentColor" aria-hidden><path d="M12 2c.6 4.9 2.9 8.3 10 10-7.1 1.7-9.4 5.1-10 10-.6-4.9-2.9-8.3-10-10 7.1-1.7 9.4-5.1 10-10Z" /></svg>
);
const COPY = "M8 8h11v11H8V8zM5 16V5h11", CHECK = "M5 12.5l4.5 4.5L19 7", REDO = "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5", RETURN = "M20 5v6a2 2 0 0 1-2 2H5M8 10l-3 3 3 3";

/** One shared clock (seconds) at ~30fps, held at a static pose under Reduce Motion, mirroring the Swift TimelineView. */
function useClock(fps = 30) {
  const [t, setT] = useState(0.35);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, last = 0; const start = performance.now();
    const tick = (now: number) => { if (now - last >= 1000 / fps) { last = now; setT((now - start) / 1000); } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return t;
}
/** Runs a timed script of setters, restarting every `loop` ms. Each step is [ms, fn]. */
function useScript(steps: [number, () => void][], loop: number) {
  useEffect(() => {
    let ts: number[] = [];
    const run = () => { ts.forEach(clearTimeout); ts = steps.map(([ms, fn]) => window.setTimeout(fn, ms)); };
    run();
    const iv = setInterval(run, loop);
    return () => { clearInterval(iv); ts.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);
}

/** The dark house ground every ai vignette stands on. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>
      {children}
    </div>
  );
}

/** Three block-colored dots rising in turn: the `.thinking` placeholder shared by StreamingReply and ThinkingState. */
const Dots = ({ t, s }: { t: number; s: number }) => (
  <span className="flex items-center" style={{ height: pt(22, s), gap: pt(6, s) }}>
    {[blocks.tangerine, blocks.sky, blocks.lilac].map((c, i) => { const ph = (((t * 0.9 - i * 0.16) % 1) + 1) % 1, lift = ph < 0.45 ? Math.sin((ph / 0.45) * Math.PI) : 0; return <span key={i} data-motion className="rounded-full" style={{ width: pt(9, s), height: pt(9, s), background: c, transform: `translateY(${pt(-5 * lift, s)}) scale(${0.8 + 0.2 * lift})` }} />; })}
  </span>
);

/** Mark, name and an uppercase phase label: the reply header. */
function ReplyHeader({ s, label, breath = 0, spin = 0 }: { s: number; label?: string; breath?: number; spin?: number }) {
  return (
    <div className="flex items-center" style={{ gap: pt(8, s) }}>
      <span className="relative grid shrink-0 place-items-center" style={{ width: pt(24, s), height: pt(24, s) }}>
        <span data-motion className="absolute inset-0 rounded-full" style={{ background: ground.text, transform: `scale(${0.84 + 0.16 * breath})` }} />
        <Sparkle size={pt(11, s)} style={{ position: "relative", color: ground.bg, transform: `rotate(${spin}deg)` }} />
      </span>
      <span style={{ fontSize: pt(15, s), fontWeight: 600 }}>Assistant</span>
      {label && <span style={{ fontSize: pt(11, s), fontWeight: 700, letterSpacing: "0.07em", color: ground.muted, fontVariantNumeric: "tabular-nums" }}>{label}</span>}
    </div>
  );
}

// MARK: Streaming Reply

const REPLY = "Revenue grew **12%** quarter over quarter and churn fell to 1.8%. The new `Insights` tab drove most of the engagement lift.".split(" ");

export function StreamingReplyPreview() {
  const s = 0.2;
  const t = useClock();
  const [phase, setPhase] = useState<"thinking" | "streaming" | "done">("thinking");
  const [n, setN] = useState(0);
  const [lifted, setLifted] = useState(false);
  const [copied, setCopied] = useState(false);
  const end = 1300 + REPLY.length * 100;
  useScript([
    [0, () => { setPhase("thinking"); setN(0); setLifted(false); setCopied(false); }],
    [1300, () => setPhase("streaming")],
    ...REPLY.map((_, i): [number, () => void] => [1300 + (i + 1) * 100, () => setN(i + 1)]),
    [end + 150, () => setPhase("done")],
    [end + 1100, () => setLifted(true)],
    [end + 2000, () => setCopied(true)],
    [end + 2900, () => { setLifted(false); }],
    [end + 3300, () => setCopied(false)],
  ], end + 4200);
  const label = phase === "thinking" ? "THINKING" : phase === "streaming" ? "WRITING" : undefined;
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col" style={{ width: pt(400, s), gap: pt(24, s), fontSize: pt(17, s), lineHeight: 1.4 }}>
        <p className="self-end" style={{ marginLeft: pt(48, s), paddingInline: pt(16, s), paddingBlock: pt(11, s), background: blocks.sky, color: ink, fontWeight: 500, borderRadius: `${pt(22, s)} ${pt(22, s)} ${pt(6, s)} ${pt(22, s)}`, opacity: lifted ? 0.35 : 1, transition: "opacity 300ms" }}>
          Summarize the <b style={{ fontWeight: 700 }}>Q3 report</b> in two lines.
        </p>
        <div className="relative" style={{ minHeight: pt(140, s), paddingRight: pt(24, s) }}>
          <div data-motion className="relative" style={{ transform: lifted ? "scale(1.02)" : "none", transformOrigin: "bottom left", transition: `transform 400ms ${springEase}` }}>
            <span data-motion className="absolute rounded-[inherit]" style={{ inset: pt(-12, s), borderRadius: pt(18, s), background: ground.surface, opacity: lifted ? 1 : 0, boxShadow: lifted ? `0 ${pt(10, s)} ${pt(22, s)} rgba(0,0,0,.5)` : "none", transition: "opacity 300ms, box-shadow 300ms" }} />
            <div className="relative flex flex-col" style={{ gap: pt(10, s) }}>
              <ReplyHeader s={s} label={label} breath={phase === "thinking" ? (Math.sin(t * 3) + 1) / 2 : 1} />
              {phase === "thinking" ? <Dots t={t} s={s} /> : (
                <p>
                  {REPLY.map((w, i) => {
                    const txt = w.replace(/\*\*|`/g, ""), on = i < n;
                    const style: CSSProperties = w.startsWith("**") ? { fontWeight: 700 } : w.startsWith("`") ? { fontFamily: font.mono, fontSize: "0.9em", background: blocks.butter, color: ink, borderRadius: pt(4, s), paddingInline: pt(3, s) } : {};
                    return <span key={i} data-motion style={{ display: "inline-block", opacity: on ? 1 : 0, transform: on ? "none" : `translateY(${pt(2, s)})`, transition: "opacity 350ms, transform 350ms", ...style }}>{txt}{i < REPLY.length - 1 ? "\u00a0" : ""}</span>;
                  })}
                  {phase === "streaming" && <span data-motion className="inline-block rounded-full align-baseline" style={{ width: pt(7, s), height: "0.78em", marginLeft: pt(4, s), background: blocks.tangerine, opacity: 0.55 + 0.45 * Math.abs(Math.sin(t * 3)) }} />}
                </p>
              )}
            </div>
          </div>
          <div data-motion className="absolute left-0 flex items-center rounded-full" style={{ top: `calc(100% + ${pt(6, s)})`, padding: pt(4, s), gap: pt(2, s), background: ground.text, color: ground.bg, fontSize: pt(15, s), fontWeight: 600, boxShadow: `0 ${pt(6, s)} ${pt(14, s)} rgba(0,0,0,.4)`, opacity: lifted ? 1 : 0, transform: lifted ? "none" : "scale(.9)", transformOrigin: "top left", transition: `opacity 250ms, transform 400ms ${springEase}` }}>
            <span className="flex items-center" style={{ height: pt(40, s), paddingInline: pt(14, s), gap: pt(6, s) }}><Icon d={copied ? CHECK : COPY} size={pt(15, s)} stroke={2.4} />{copied ? "Copied" : "Copy"}</span>
            <span className="flex items-center" style={{ height: pt(40, s), paddingInline: pt(14, s), gap: pt(6, s) }}><Icon d={REDO} size={pt(15, s)} stroke={2.4} />Regenerate</span>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Thinking State

export function ThinkingStatePreview() {
  const s = 0.19;
  const t = useClock(), D = 2.2;
  const sweep = (t % D) / D, breath = (Math.sin((t * 2 * Math.PI) / D) + 1) / 2;
  const elapsed = Math.floor(t % 9) + 1;
  const [active, setActive] = useState(true);
  useEffect(() => { const i = setInterval(() => setActive((v) => !v), 3000); return () => clearInterval(i); }, []);
  const band = (strength: string): CSSProperties => ({ backgroundImage: `linear-gradient(90deg, transparent ${(sweep * 180 - 65).toFixed(1)}%, ${strength} ${(sweep * 180 - 40).toFixed(1)}%, transparent ${(sweep * 180 - 15).toFixed(1)}%)` });
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 grid-cols-2" style={{ width: pt(460, s), columnGap: pt(40, s), rowGap: pt(34, s), fontSize: pt(17, s) }}>
        <div className="flex flex-col" style={{ gap: pt(10, s) }}>
          <ReplyHeader s={s} label={`THINKING · ${elapsed}S`} breath={breath} spin={breath * 45} />
          <Dots t={t} s={s} />
        </div>
        <div className="flex flex-col" style={{ gap: pt(10, s) }}>
          <ReplyHeader s={s} label={`THINKING · ${elapsed}S`} breath={breath} spin={breath * 45} />
          <div className="flex flex-col" style={{ gap: pt(9, s), paddingBlock: pt(3, s) }}>
            {["100%", "62%"].map((w) => <span key={w} data-motion className="rounded-full" style={{ width: w, height: pt(13, s), backgroundColor: ground.raised, ...band("#3a3937") }} />)}
          </div>
        </div>
        <p data-motion className="self-center" style={{ color: ground.muted, backgroundClip: "text", WebkitBackgroundClip: "text", ...band(ground.text), WebkitTextFillColor: "transparent", backgroundColor: ground.muted }}>Reading the Q3 report</p>
        <span data-motion className="relative flex items-center self-center justify-self-start overflow-hidden rounded-full" style={{ height: pt(44, s), paddingInline: pt(16, s), gap: pt(8, s), background: blocks.butter, color: ink, fontSize: pt(15, s), fontWeight: 600 }}>
          <Sparkle size={pt(14, s)} />Drafting reply
          <span aria-hidden data-motion className="pointer-events-none absolute inset-0" style={{ ...band("rgba(255,255,255,.7)"), opacity: active ? 1 : 0, transition: "opacity 200ms", mixBlendMode: "plus-lighter" }} />
        </span>
      </div>
    </Stage>
  );
}

// MARK: Prompt Chips

const CHIPS: [string, string, string][] = [
  ["Summarize this page", blocks.tangerine, "M4 6h16M4 10h16M4 14h10M4 18h13"],
  ["Draft a reply to Mara", blocks.sky, "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v4"],
  ["Find action items", blocks.butter, "M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"],
  ["Plan my week", blocks.sage, "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"],
];

export function PromptChipsPreview() {
  const s = 0.23;
  const chosen = 1, row = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0); // 0 hidden, 1 revealed, 2 inserted at the chip's frame, 3 released to composer width, 4 landed
  const [rect, setRect] = useState({ left: 0, width: 0 });
  useScript([
    [0, () => setStep(0)],
    [80, () => setStep(1)],
    [2000, () => { const el = row.current?.children[chosen] as HTMLElement | undefined; if (el) setRect({ left: el.offsetLeft, width: el.offsetWidth }); setStep(2); }],
    [2040, () => setStep(3)],
    [2500, () => setStep(4)],
  ], 3600);
  const flying = step >= 2, released = step >= 3, landed = step === 4;
  const [title, color, glyph] = CHIPS[chosen];
  return (
    <Stage>
      <div className="absolute inset-x-0" style={{ top: "50%", transform: "translateY(-50%)" }}>
        <div data-motion className="relative overflow-hidden" style={{ height: landed ? 0 : pt(60, s), transition: `height 300ms ${ease}` }}>
          <div ref={row} className="relative flex whitespace-nowrap" style={{ gap: pt(8, s), paddingInline: pt(16, s), paddingBlock: pt(4, s) }}>
            {CHIPS.map(([c, block, d], i) => {
              const me = i === chosen, show = step >= 1 && !(me && flying) && !(released && !me);
              return (
                <span key={c} data-motion className="flex shrink-0 items-center" style={{ height: pt(52, s), paddingLeft: pt(8, s), paddingRight: pt(16, s), gap: pt(10, s), borderRadius: pt(18, s), background: ground.surface, fontSize: pt(15, s), fontWeight: 600, opacity: show ? 1 : 0, transform: `translate(${released && !me ? pt(i < chosen ? -32 : 32, s) : "0px"}, ${step >= 1 ? "0px" : pt(8, s)}) scale(${step >= 1 ? 1 : 0.9})`, transition: step === 0 || (me && flying) ? "none" : `opacity 300ms, transform 450ms ${springEase} ${step === 1 ? i * 50 : 0}ms` }}>
                  <span className="grid place-items-center rounded-full" style={{ width: pt(32, s), height: pt(32, s), background: block, color: ink }}><Icon d={d} size={pt(14, s)} stroke={2.6} /></span>
                  {c}
                </span>
              );
            })}
            <span data-motion className="absolute flex items-center" style={{ top: pt(4, s), height: pt(52, s), paddingInline: pt(18, s), gap: pt(10, s), borderRadius: pt(18, s), background: color, color: ink, fontSize: pt(17, s), fontWeight: 600, left: released ? pt(16, s) : rect.left, width: released ? `calc(100% - ${pt(32, s)})` : rect.width, opacity: flying && !landed ? 1 : 0, transition: released ? `left 450ms ${springEase}, width 450ms ${springEase}, opacity 150ms` : "none" }}>
              <Icon d={glyph} size={pt(15, s)} stroke={2.6} />{title}
            </span>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Code Block

const K = blocks.tangerine, T = blocks.sky, STR = blocks.sage, NUM = blocks.lilac, M = ground.muted, P = "";
const CODE: [string, string][][] = [
  [[M, "/// Greets someone by name."]],
  [[K, "func"], [P, " greet"], [M, "("], [P, "_ name"], [M, ": "], [T, "String"], [M, ") -> "], [T, "String"], [M, " {"]],
  [[M, "    // Interpolation keeps it simple."]],
  [[P, "    "], [K, "return"], [STR, " \"Hello, \\(name)!\""]],
  [[M, "}"]],
  [[P, ""]],
  [[K, "let"], [P, " names "], [M, "= ["], [STR, "\"Mara\""], [M, ", "], [STR, "\"Jonas\""], [M, "]"]],
  [[P, "names"], [M, "."], [P, "prefix"], [M, "("], [NUM, "2"], [M, ")."], [P, "map"], [M, "("], [P, "greet"], [M, ")"]],
];

export function CodeBlockPreview() {
  const s = 0.19;
  const [shown, setShown] = useState(1);
  const [copied, setCopied] = useState(false);
  useScript([
    [0, () => { setShown(1); setCopied(false); }],
    ...CODE.slice(1).map((_, i): [number, () => void] => [380 * (i + 1), () => setShown(i + 2)]),
    [380 * CODE.length + 700, () => setCopied(true)],
    [380 * CODE.length + 2300, () => setCopied(false)],
  ], 380 * CODE.length + 3200);
  const streaming = shown < CODE.length;
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: pt(420, s) }}>
        <div style={{ borderRadius: pt(26, s), background: ground.surface }}>
          <div className="flex items-center" style={{ height: pt(52, s), paddingLeft: pt(18, s), paddingRight: pt(8, s), gap: pt(8, s) }}>
            <span className="rounded-full" style={{ background: blocks.butter, color: ink, fontSize: pt(11, s), fontWeight: 800, letterSpacing: "0.07em", paddingInline: pt(8, s), paddingBlock: pt(4, s) }}>SWIFT</span>
            <span className="flex-1" style={{ fontSize: pt(13, s), fontWeight: 600 }}>Greeter.swift</span>
            <span className="grid place-items-center rounded-full" style={{ width: pt(34, s), height: pt(34, s), background: ground.raised, color: ground.muted }}><Icon d={RETURN} size={pt(14, s)} /></span>
            <span data-motion className="flex items-center rounded-full" style={{ height: pt(34, s), paddingInline: pt(12, s), gap: pt(6, s), fontSize: pt(13, s), fontWeight: 600, background: copied ? blocks.sage : ground.raised, color: copied ? ink : ground.text, transform: copied ? "scale(1.04)" : "none", transition: `background 250ms, color 250ms, transform 350ms ${springEase}` }}>
              <Icon key={String(copied)} d={copied ? CHECK : COPY} size={pt(14, s)} stroke={2.4} />{copied ? "Copied" : "Copy"}
            </span>
          </div>
          <pre className="flex" style={{ gap: pt(14, s), paddingInline: pt(18, s), paddingBottom: pt(18, s), fontFamily: font.mono, fontSize: pt(13, s), lineHeight: 1.55, color: ground.text, height: pt(8 * 13 * 1.55 + 18, s), boxSizing: "content-box" }}>
            <span className="text-right" style={{ color: "#6e6b66" }}>{CODE.slice(0, shown).map((_, i) => <span key={i} className="block">{i + 1}</span>)}</span>
            <span className="min-w-0">
              {CODE.slice(0, shown).map((line, i) => (
                <span key={i} data-motion className="block whitespace-pre" style={{ animation: `cb-in 250ms ${ease}` }}>
                  {line.map(([c, txt], j) => <span key={j} style={{ color: c || undefined, fontWeight: c === K ? 700 : undefined }}>{txt}</span>)}
                  {line.length === 1 && !line[0][1] ? " " : ""}
                  {streaming && i === shown - 1 && <span className="inline-block rounded-full align-middle" style={{ width: pt(5, s), height: "0.9em", marginLeft: pt(4, s), background: blocks.tangerine }} />}
                </span>
              ))}
            </span>
          </pre>
        </div>
      </div>
      <style>{"@keyframes cb-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}"}</style>
    </Stage>
  );
}

// MARK: Assistant Orb

/** The thinking orb at hero size: the WebGL port of the piece's Metal kernel. The sphere never moves, only the wave. */
export function AssistantOrbPreview() {
  return (
    <Stage>
      <Center className="flex-col gap-[4cqw]">
        <SiriWaveOrb size="min(46cqw, 60cqh)" palette={SIRI} />
        <span className="text-[13px] font-medium" style={{ color: ground.muted }}>Thinking</span>
      </Center>
    </Stage>
  );
}

// MARK: Thought Orb

/** The Swift `ThoughtOrb.Palette` presets, same hex values: the mark's colour is the kind of work. */
const SEARCHING: OrbPalette = { bands: ["#5ee7ff", "#22c3e6", "#1492b8", "#0b5f86"], ground: "#04161f", cool: "#9af0ff", warm: "#3fd6b4" };
const READING: OrbPalette = { bands: ["#a99bff", "#7b6cff", "#5a3ff0", "#3a20b8"], ground: "#0d0826", cool: "#c4baff", warm: "#b07cff" };
const WRITING: OrbPalette = { bands: ["#ffc46b", "#ff9a4a", "#ff6a3d", "#d9412b"], ground: "#1e0a05", cool: "#ffd9a0", warm: "#ff7a3a" };
const STEPS: [string, OrbPalette][] = [["Thinking", SIRI], ["Searching sources", SEARCHING], ["Reading the thread", READING], ["Drafting a reply", WRITING]];

/** Hero mark over the status pill. The label steps through kinds of work and the mark's colour follows it; the motion never changes. */
export function ThoughtOrbPreview() {
  const [step, setStep] = useState(0);
  const clock = useClock();
  useScript(STEPS.map((_, i): [number, () => void] => [i * 1500, () => setStep(i)]), 6000);
  const dotOpacity = (i: number) => { let p = ((clock - i * 0.12) / 1.6) % 1; if (p < 0) p += 1; return p < 0.3 ? 0.28 + 0.72 * (p / 0.3) : p < 0.6 ? 1 - 0.72 * ((p - 0.3) / 0.3) : 0.28; };
  return (
    <Stage>
    <Center className="flex-col gap-5">
      <SiriWaveOrb size="min(38cqw, 50cqh)" palette={STEPS[step][1]} />
      <span className="flex items-center gap-[7px] rounded-full border border-white/10 py-1 pr-3.5 pl-1.5 text-[12.5px] font-medium shadow-[0_1px_3px_rgba(0,0,0,.25)]" style={{ background: ground.raised, color: ground.text }}>
        <SiriWaveOrb size={18} palette={STEPS[step][1]} />
        <span key={step} data-motion style={{ animation: "rise .3s var(--ease-out)" }}>{STEPS[step][0]}</span>
        <span className="ml-[1px] flex gap-[2px]" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} data-motion className="size-[3px] rounded-full bg-foreground" style={{ opacity: dotOpacity(i) }} />)}</span>
      </span>
    </Center>
    </Stage>
  );
}
