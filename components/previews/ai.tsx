"use client";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Center } from "./frame";
import { blocks, font, ground, ink, groundHex, signal } from "./palette";
import { curve, pop, pressScale, reduced, roles, settleTime, springValue, t, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, MorphText, glass, liquid } from "./piece-liquid";
import { SIRI, SiriWaveOrb, type OrbPalette } from "./siri-wave-orb";

/** iOS points to container units. `s` is cqw per point for the vignette. */
const pt = (n: number, s: number) => `${+(n * s).toFixed(3)}cqw`;
/** Custom properties in an inline style. */
const vars = (v: Record<string, string>) => v as CSSProperties;

const Icon = ({ d, size, stroke = 2.2, style }: { d: string; size: string; stroke?: number; style?: CSSProperties }) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0, ...style }} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
/** SF `sparkle`: one four-point star. */
const Sparkle = ({ size, style }: { size: string; style?: CSSProperties }) => (
  <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0, ...style }} fill="currentColor" aria-hidden><path d="M12 2c.6 4.9 2.9 8.3 10 10-7.1 1.7-9.4 5.1-10 10-.6-4.9-2.9-8.3-10-10 7.1-1.7 9.4-5.1 10-10Z" /></svg>
);
const COPY = "M8 8h11v11H8V8zM5 16V5h11", CHECK = "M5 12.5l4.5 4.5L19 7", REDO = "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5", RETURN = "M20 5v6a2 2 0 0 1-2 2H5M8 10l-3 3 3 3";

/** Rises read `--rise`, so each caller sets its own distance in its own units. */
const KEYFRAMES = [
  "@keyframes ai-ink-o{from{opacity:0}}",
  "@keyframes ai-ink-y{from{transform:translateY(var(--rise))}}",
  "@keyframes ai-line{from{opacity:0;transform:translateY(var(--rise))}}",
  // A cursor's slow breath between full and 55%, starting from full so it never jumps.
  "@keyframes ai-breathe{50%{opacity:.55}}",
  // A glyph swapped inside its glass: the new one sharpens in as the old one goes (`motion.swap`).
  "@keyframes ai-swap{from{opacity:0;filter:blur(3px);transform:scale(.8)}}",
].join("");

/**
 * One shared clock (seconds) at ~30fps from mount, mirroring the Swift TimelineView. It runs under Reduce Motion
 * too, where the pieces only change opacity with it. The ref is for script steps that start a local clock.
 */
function useClock(fps = 30) {
  const [time, setTime] = useState(0);
  const at = useRef(0);
  useEffect(() => {
    let raf = 0, last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can predate `start`, so the first tick is clamped to the clock's origin.
      if (now - last >= 1000 / fps) { last = now; at.current = Math.max((now - start) / 1000, 0); setTime(at.current); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return [time, at] as const;
}
/** Reduce Motion as state, read after mount, so the server and the first client render agree. */
function useReduced() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(reduced()), []);
  return on;
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
/** Plays one WAAPI pop on an element, unless Reduce Motion is on, and cancels it on unmount. */
function usePop(amount: number) {
  const el = useRef<HTMLSpanElement>(null), live = useRef<Animation | null>(null);
  useEffect(() => () => live.current?.cancel(), []);
  const play = () => {
    if (!el.current || reduced()) return;
    live.current?.cancel();
    live.current = el.current.animate(...pop(amount));
  };
  return [el, play] as const;
}

/**
 * Widths of `words` in em, measured in the font of the element the returned node sits in, so a capsule can morph
 * between labels on clip-path and transform while its layout holds still. A 10em ruler cancels any transform on the
 * stage. Re-measures once web fonts load and whenever the stage resizes.
 */
function useEmWidths(words: string[], fallback: number[]) {
  const box = useRef<HTMLSpanElement>(null);
  const [em, setEm] = useState(fallback);
  const key = words.join("|");
  useLayoutEffect(() => {
    const el = box.current, ruler = el?.lastElementChild as HTMLElement | null | undefined;
    if (!el || !ruler) return;
    let live = true;
    const read = () => {
      const unit = ruler.getBoundingClientRect().width / 10;
      if (!live || unit <= 0) return;
      const next = Array.from(el.children).slice(0, -1).map((c) => +(c.getBoundingClientRect().width / unit).toFixed(3));
      setEm((was) => (was.join() === next.join() ? was : next));
    };
    read();
    document.fonts?.ready.then(read);
    const ro = new ResizeObserver(read);
    ro.observe(ruler);
    return () => { live = false; ro.disconnect(); };
  }, [key]);
  const node = (
    <span ref={box} aria-hidden className="pointer-events-none absolute left-0 top-0 whitespace-nowrap" style={{ visibility: "hidden" }}>
      {words.map((w) => <span key={w} className="inline-block">{w}</span>)}
      <span className="inline-block" style={{ width: "10em" }} />
    </span>
  );
  return [em, node] as const;
}

/** The dark house ground every ai vignette stands on. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, color: ground.text, fontFamily: font.stack }}>
      {children}
      <style>{KEYFRAMES}</style>
    </div>
  );
}

/**
 * Three block-colored dots rising in turn: the `.thinking` placeholder shared by StreamingReply and ThinkingState.
 * Each rise eases out of rest and back into it, and `t` starts as they appear, so the first dot leads from rest.
 * Under Reduce Motion they hold still and the same ripple runs through their opacity.
 */
const Dots = ({ t, s, still = false }: { t: number; s: number; still?: boolean }) => (
  <span className="flex items-center" style={{ height: pt(22, s), gap: pt(6, s) }}>
    {[blocks.tangerine, blocks.sky, blocks.lilac].map((c, i) => {
      const ph = (((t * 0.9 - i * 0.16) % 1) + 1) % 1, wave = ph < 0.45 ? Math.sin((ph / 0.45) * Math.PI) : 0, lift = wave * wave;
      return <span key={i} data-motion className="rounded-full" style={{ width: pt(9, s), height: pt(9, s), background: c, opacity: still ? 0.5 + 0.5 * lift : 1, transform: still ? "scale(.8)" : `translateY(${pt(-5 * lift, s)}) scale(${0.8 + 0.2 * lift})` }} />;
    })}
  </span>
);

/**
 * Words inside a `LiquidGroup` that are not glass. A clear shape draws nothing in the glass pass and its children only
 * in the content pass, so text never runs through the goo, while the layout stays the same in both passes.
 */
const Plain = ({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) => (
  <Liquid tint="transparent" radius={0} className={className} style={style}>{children}</Liquid>
);

/**
 * Mark, name and an uppercase phase label: the words on the reply's glass header pill, 32pt tall with the pill's own
 * insets, so a caller only puts glass behind it. `breath` 0 is the rest pose, full size and upright, which both pieces
 * share, so a swap between them lands without a snap. `glyph` is the sparkle's opacity. The label morphs letter by
 * letter after a `prefix` that holds still.
 */
function ReplyHeader({ s, label, prefix, breath = 0, glyph = 1, glyphMotion }: { s: number; label?: string; prefix?: string; breath?: number; glyph?: number; glyphMotion?: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap" style={{ height: pt(32, s), paddingLeft: pt(4, s), paddingRight: pt(12, s) }}>
      <span className="relative grid shrink-0 place-items-center" style={{ width: pt(24, s), height: pt(24, s) }}>
        <span data-motion className="absolute inset-0 rounded-full" style={{ background: ground.text, transform: `scale(${1 - 0.16 * breath})` }} />
        <Sparkle size={pt(11, s)} style={{ position: "relative", color: ground.bg, opacity: glyph, transform: `rotate(${breath * 45}deg)`, transition: glyphMotion }} />
      </span>
      <span style={{ marginLeft: pt(8, s), fontSize: pt(15, s), fontWeight: 600, lineHeight: 1 }}>Assistant</span>
      {label ? (
        <span className="inline-flex whitespace-pre" style={{ marginLeft: pt(8, s), fontSize: pt(11, s), fontWeight: 600, lineHeight: 1, letterSpacing: "0.07em", color: ground.muted, fontVariantNumeric: "tabular-nums" }}>
          {prefix}<MorphText text={label} />
        </span>
      ) : null}
    </span>
  );
}

// MARK: Streaming Reply

const REPLY = "Revenue grew **12%** quarter over quarter and churn fell to 1.8%. The new `Insights` tab drove most of the engagement lift.".split(" ");
/** Swift's demo: a 1.2s think, then the reply in chunks of three words, 240ms apart, and done with the last chunk. */
const THINK = 1200, CHUNK = 3, BEAT = 240, CHUNKS = Math.ceil(REPLY.length / CHUNK), STREAMED = THINK + CHUNKS * BEAT;
/** A word inks in over 0.35s: opacity on a cubic ease-out, so it reads almost at once, and its 2pt rise on a softer quadratic one that trails. */
const INK = 350, INK_OPACITY = "cubic-bezier(0.33, 1, 0.68, 1)", INK_RISE = "cubic-bezier(0.5, 1, 0.89, 1)";
/** The hold's sink: the calm tier's pace without its give, since a press never bounces under the finger. */
const SINK: Spring = { duration: 0.5, bounce: 0 };
/** The Copy bubble, about 96 by 44pt. */
const ACTION_PRESS = pressScale(96, 44);
/** The reply column, in points, and the card's reach past its words. */
const COLUMN = 400, CARD = 12, ACTION_H = 44;

export function StreamingReplyPreview() {
  const s = 0.2, U = pt(1, s);
  const [clock, at] = useClock(), still = useReduced();
  const [phase, setPhase] = useState<"thinking" | "streaming" | "done">("thinking");
  const [thinkFrom, setThinkFrom] = useState(0);
  const [n, setN] = useState(0);
  const [hold, setHold] = useState<"rest" | "sink" | "lifted">("rest");
  const [copyDown, setCopyDown] = useState(false);
  const [copied, setCopied] = useState(false);
  // The actions exist from the touch until they have melted home, as Swift's buds do: added home, sent out, removed.
  const [actions, setActions] = useState(false);
  const [copyPop, playPop] = usePop(0.06);
  const [em, measure] = useEmWidths(["Copy", "Copied", "Regenerate"], [2.4, 3.3, 5.6]);
  // The header pill's width and the message's height, in points, so the card can swell out of the one around the other.
  const column = useRef<HTMLDivElement>(null), message = useRef<HTMLDivElement>(null), header = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState({ pill: 150, height: 120 });
  useLayoutEffect(() => {
    const col = column.current, msg = message.current, head = header.current;
    if (!col || !msg || !head) return;
    const read = () => {
      const perPt = col.offsetWidth / COLUMN;
      if (perPt <= 0) return;
      const next = { pill: +(head.offsetWidth / perPt).toFixed(2), height: +(msg.offsetHeight / perPt).toFixed(2) };
      setBox((was) => (was.pill === next.pill && was.height === next.height ? was : next));
    };
    read();
    const ro = new ResizeObserver(read);
    [col, msg, head].forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, []);
  const e = STREAMED;
  useScript([
    [0, () => { setThinkFrom(at.current); setPhase("thinking"); setN(0); setHold("rest"); setCopyDown(false); setCopied(false); setActions(false); }],
    // Streaming with no words yet keeps the dots' line, with the cursor alone.
    [THINK, () => setPhase("streaming")],
    ...Array.from({ length: CHUNKS }, (_, k): [number, () => void] => [THINK + (k + 1) * BEAT, () => { setN(Math.min((k + 1) * CHUNK, REPLY.length)); if (k === CHUNKS - 1) setPhase("done"); }]),
    // Press and hold: after a beat the message sinks toward its tail, then at 0.35s springs up as the header pill
    // swells into a card around it and the actions bud out of it.
    [e + 1100, () => { setHold("sink"); setActions(true); }],
    [e + 1350, () => setHold("lifted")],
    [e + 2150, () => setCopyDown(true)],
    // Copy: the bubble tints sage, its glyph swaps to a check and its label morphs, and it pops. Set down 0.9s later.
    [e + 2270, () => { setCopyDown(false); setCopied(true); playPop(); }],
    [e + 3170, () => setHold("rest")],
    [e + 3670, () => { setCopied(false); setActions(false); }],
  ], e + 4300);
  const lifted = hold === "lifted", thinking = phase === "thinking";
  const pulse = thinking && !still ? Math.sin((Math.PI * (clock - thinkFrom)) / 1.1) ** 2 : 0;
  const label = phase === "thinking" ? "THINKING" : phase === "streaming" ? "WRITING" : "";
  // The actions, laid out from their labels, and where each melts to: the header pill's centre, so they grow out of it
  // with the card and shrink back into it with the card.
  const copyW = 49 + 15 * em[copied ? 1 : 0], regenW = 49 + 15 * em[2];
  const restY = box.height + CARD + liquid.joined + ACTION_H / 2, pillX = box.pill / 2, pillY = 4 + 16;
  const homeOf = (x: number): [number, number] => [+(pillX - x).toFixed(2), +(pillY - restY).toFixed(2)];
  const action = (name: "copy" | "regenerate", x: number) => {
    const isCopy = name === "copy", done = isCopy && copied;
    return (
      <Liquid radius="capsule" tint={lifted && done ? blocks.sage : undefined} bud={{ out: lifted, home: homeOf(x) }} style={{ flexShrink: 0 }}>
        <BudContent out={lifted}>
          <span data-motion className="flex" style={{ transform: isCopy && copyDown && !still ? `scale(${ACTION_PRESS})` : "none", transition: t("transform", copyDown ? "press" : "release") }}>
            <span ref={isCopy ? copyPop : undefined} className="flex items-center whitespace-nowrap" style={{ height: pt(ACTION_H, s), width: pt(isCopy ? copyW : regenW, s), paddingInline: pt(14, s), gap: pt(6, s), color: done ? ink : ground.text, fontSize: pt(15, s), fontWeight: 600, transition: isCopy ? t("width", "morph") : undefined }}>
              <Icon key={isCopy ? String(copied) : "redo"} d={isCopy ? (copied ? CHECK : COPY) : REDO} size={pt(15, s)} stroke={2.4} style={{ animation: `ai-swap ${curve("snap").ms}ms ${curve("snap").easing} both` }} />
              <MorphText text={isCopy ? (copied ? "Copied" : "Copy") : "Regenerate"} />
            </span>
          </span>
        </BudContent>
      </Liquid>
    );
  };
  return (
    <Stage>
      <span aria-hidden className="pointer-events-none absolute" style={{ fontSize: pt(15, s), fontWeight: 600 }}>{measure}</span>
      <div ref={column} className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col" style={{ width: pt(COLUMN, s), gap: pt(24, s), fontSize: pt(17, s), lineHeight: 1.4, fontWeight: 600 }}>
        {/* The prompt: a signal-tinted glass bubble with house ink. It steps back while the reply is lifted. */}
        <LiquidGroup unit={U} className="self-end" style={{ marginLeft: pt(48, s), opacity: lifted ? 0.35 : 1, transition: t("opacity", lifted ? "reveal" : "dismiss") }}>
          <Liquid tint={signal.fill} style={{ paddingInline: pt(16, s), paddingBlock: pt(11, s), color: ink, borderRadius: `${pt(22, s)} ${pt(22, s)} ${pt(6, s)} ${pt(22, s)}` }}>
            Summarize the Q3 report in two lines.
          </Liquid>
        </LiquidGroup>
        <div style={{ minHeight: pt(140, s), paddingBottom: pt(CARD + liquid.joined + ACTION_H, s) }}>
          <LiquidGroup unit={U} axis="both">
            {/* Only the message springs: the sink has no give, the lift springs up out of it, and it lands back on settle
                with a little give. Under Reduce Motion it keeps its size and the card carries the lift. */}
            <div ref={message} data-motion className="relative" style={{ transform: still ? "none" : lifted ? "scale(1.02)" : hold === "sink" ? "scale(.985)" : "none", transformOrigin: "bottom left", transition: t("transform", lifted ? "release" : hold === "sink" ? SINK : "settle") }}>
              {/* One glass shape: the header pill at rest, swelling into a card around the whole reply on the split
                  spring, and shrinking back into the pill with no bounce. */}
              <Liquid radius={lifted ? 18 : 16} style={{
                position: "absolute",
                left: lifted ? pt(-CARD, s) : 0, top: lifted ? pt(-CARD, s) : pt(4, s),
                width: lifted ? `calc(100% + ${pt(2 * CARD, s)})` : pt(box.pill, s), height: lifted ? `calc(100% + ${pt(2 * CARD, s)})` : pt(32, s),
                transition: t(["left", "top", "width", "height", "border-radius"], lifted ? liquid.split : liquid.home),
              }} />
              <Plain className="relative flex flex-col" style={{ gap: pt(10, s), paddingBlock: pt(4, s), paddingRight: pt(24, s) }}>
                <span ref={header} className="self-start">
                  <ReplyHeader s={s} label={label} glyph={1 - 0.6 * pulse} glyphMotion={thinking ? undefined : t("opacity", "reveal")} />
                </span>
                <div className="grid">
                  <span data-motion className="self-start" style={{ gridArea: "1 / 1", opacity: thinking ? 1 : 0, transition: t("opacity", "reveal") }}>
                    <Dots t={clock - thinkFrom} s={s} still={still} />
                  </span>
                  <p style={{ gridArea: "1 / 1" }}>
                    {REPLY.slice(0, n).map((w, i) => {
                      const txt = w.replace(/\*\*|`/g, "");
                      // Inline code sits on a faint chip in the text colour; strong emphasis keeps the one weight.
                      const look: CSSProperties = w.startsWith("`") ? { fontFamily: font.mono, fontSize: "0.9em", background: `color-mix(in srgb, currentColor 10%, transparent)`, borderRadius: pt(5, s), paddingInline: pt(3, s) } : {};
                      // Words that arrive together ink in left to right, 24ms apart.
                      const delay = Math.min((i % CHUNK) * 24, 120);
                      return (
                        <Fragment key={i}>
                          {i > 0 && " "}
                          <span data-motion style={{ display: "inline-block", animation: `ai-ink-o ${INK}ms ${INK_OPACITY} ${delay}ms both, ai-ink-y ${INK}ms ${INK_RISE} ${delay}ms both`, ...vars({ "--rise": pt(still ? 0 : 2, s) }), ...look }}>{txt}</span>
                        </Fragment>
                      );
                    })}
                    {/* A small tinted bubble: solid while words land, like a caret while typing; it breathes 0.4s after the last one settles. */}
                    {phase === "streaming" && <span key={n} data-motion className="inline-block rounded-full align-baseline" style={{ width: pt(7, s), height: "0.78em", marginLeft: n ? pt(4, s) : 0, background: blocks.tangerine, animation: `ai-breathe 1200ms ease-in-out ${n ? INK + 48 + 400 : 400}ms infinite` }} />}
                  </p>
                </div>
              </Plain>
              {/* Copy and Regenerate: separate actions resting apart, a neck's width under the card. */}
              <div className="absolute left-0 flex" style={{ top: `calc(100% + ${pt(CARD + liquid.joined, s)})`, gap: pt(liquid.apart, s) }}>
                {actions && action("copy", copyW / 2)}
                {actions && action("regenerate", copyW + liquid.apart + regenW / 2)}
              </div>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Thinking State

/**
 * Where a clock `time` seconds old is in its pass of `D`, as Swift's ThinkingPass: the band eases across over the
 * first 80%, then rests clear of the view. `breath` rises from 0 and falls back with it.
 */
function thinkingPass(time: number, D = 2.2) {
  const u = Math.min(((Math.max(time, 0) / D) % 1) / 0.8, 1);
  return { travel: u * u * (3 - 2 * u), breath: Math.sin(Math.PI * u) ** 2 };
}
/**
 * One soft band, half the view wide, sliding whole from just clear of the leading edge to just clear of the
 * trailing one, so it keeps its width as it enters and leaves. Under Reduce Motion an even glow on the breath.
 */
function sheen(pass: ReturnType<typeof thinkingPass>, color: string, still: boolean): CSSProperties {
  if (still) {
    const glow = `color-mix(in srgb, ${color} ${(40 * pass.breath).toFixed(1)}%, transparent)`;
    return { backgroundImage: `linear-gradient(${glow}, ${glow})` };
  }
  const c = -0.25 + pass.travel * 1.5, at = (x: number) => `${(x * 100).toFixed(2)}%`;
  return { backgroundImage: `linear-gradient(90deg, transparent ${at(c - 0.25)}, ${color} ${at(c)}, transparent ${at(c + 0.25)})` };
}
/** Text that carries a sheen through its glyphs. */
const glyphSheen = (pass: ReturnType<typeof thinkingPass>, band: string, base: string, still: boolean): CSSProperties => ({
  ...sheen(pass, band, still), backgroundColor: base, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
});

export function ThinkingStatePreview() {
  const s = 0.19, D = 2.2, U = pt(1, s);
  const [clock, at] = useClock(), still = useReduced();
  // The placeholder restarts every four passes, so the seconds start over and the first pass enters from the edge.
  const local = clock % (4 * D), pass = thinkingPass(local, D);
  const elapsed = Math.floor(local);
  const [active, setActive] = useState(true);
  const [activeFrom, setActiveFrom] = useState(0);
  useEffect(() => {
    let on = true;
    // The modifier's own pass starts from the leading edge each time it turns on.
    const i = setInterval(() => { on = !on; if (on) setActiveFrom(at.current); setActive(on); }, 3000);
    return () => clearInterval(i);
  }, [at]);
  const chipPass = thinkingPass(clock - activeFrom);
  // The header on its glass pill. Each second the count morphs: the digits it shares with the last one hold still.
  const header = (
    <LiquidGroup unit={U} className="self-start">
      <Liquid radius="capsule" className="flex">
        <ReplyHeader s={s} prefix="THINKING · " label={`${elapsed}S`} breath={still ? 0 : pass.breath} />
      </Liquid>
    </LiquidGroup>
  );
  return (
    <Stage>
      <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 grid-cols-2" style={{ width: pt(460, s), columnGap: pt(40, s), rowGap: pt(34, s), fontSize: pt(17, s), fontWeight: 600 }}>
        <div className="flex flex-col" style={{ gap: pt(10, s) }}>
          {header}
          <Dots t={local} s={s} still={still} />
        </div>
        <div className="flex flex-col" style={{ gap: pt(10, s) }}>
          {header}
          <div className="flex flex-col" style={{ gap: pt(9, s), paddingBlock: pt(3, s) }}>
            {/* Swift masks one sheen to the whole stack, so the short bar paints the column's band and shows its first
                62%. The band is a faint white added on: Swift's #3a3937 over the bar in dark, near white in light. */}
            {[1, 0.62].map((w) => (
              <span key={w} data-motion className="relative overflow-hidden rounded-full" style={{ width: `${w * 100}%`, height: pt(13, s), background: ground.field }}>
                <span aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${+(100 / w).toFixed(3)}%`, mixBlendMode: "plus-lighter", ...sheen(pass, "rgba(255,255,255,.08)", still) }} />
              </span>
            ))}
          </div>
        </div>
        <p data-motion className="self-center" style={{ color: ground.muted, ...glyphSheen(pass, ground.text, ground.muted, still) }}>Reading the Q3 report</p>
        {/* The modifier on a glass status pill: the sweep runs through the label's glyphs, so the glass stays clear. */}
        <LiquidGroup unit={U} className="self-center justify-self-start">
          <Liquid radius="capsule" className="flex items-center" style={{ height: pt(44, s), paddingInline: pt(16, s), gap: pt(8, s), fontSize: pt(15, s), fontWeight: 600, color: ground.text }}>
            <Sparkle size={pt(14, s)} />
            <span className="relative">
              Drafting reply
              <span aria-hidden data-motion className="pointer-events-none absolute inset-0" style={{ ...glyphSheen(chipPass, "rgba(255,255,255,.7)", "transparent", still), opacity: active ? 1 : 0, transition: t("opacity", active ? "reveal" : "dismiss") }}>Drafting reply</span>
            </span>
          </Liquid>
        </LiquidGroup>
      </div>
    </Stage>
  );
}

// MARK: Prompt Chips

const CHIPS: [string, string, string][] = [
  ["Summarize", blocks.tangerine, "M4 6h16M4 10h16M4 14h10M4 18h13"],
  ["Draft a reply", blocks.sky, "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v4"],
  ["Action items", blocks.butter, "M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"],
  ["Plan my week", blocks.sage, "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"],
  ["Translate", blocks.lilac, "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3c-2.5 2.6-3.8 5.6-3.8 9s1.3 6.4 3.8 9"],
  ["Make it shorter", blocks.tangerine, "M14 10l6-6M20 9V4h-5M10 14l-6 6M4 15v5h5"],
];
/** Swift's example: `.grid(columns: 2)`, 12pt apart both ways. They melt into each other inside 10pt, under that gap,
 *  so they rest as their own bubbles and only join while one flows into another. */
const COLS = 2, CHIP_GAP = 12, CHIP_MELT = 10;
/** A chip is 52pt tall and about 216pt wide in a column, so it dents about 2.5pt per edge. */
const CHIP_H = 52, CHIP_PRESS = pressScale(216, CHIP_H);
const GRID_ROWS = Math.ceil(CHIPS.length / COLS);
const GRID_H = GRID_ROWS * CHIP_H + (GRID_ROWS - 1) * CHIP_GAP + 16;
/** Places between two chips in the grid, so the others flow into the chosen one nearest first. */
const ripple = (a: number, b: number) => Math.max(Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)), Math.abs((a % COLS) - (b % COLS)));

export function PromptChipsPreview() {
  const s = 0.21;
  const still = useReduced();
  const chosen = 1;
  // The chosen chip's disc pops as it is chosen; the hook cancels the pop on unmount.
  const [disc, popDisc] = usePop(0.18);
  // 0 hidden, 1 cascaded in, 2 pressed, 3 chosen (it swells and the others flow into it, melting into its glass),
  // 4 handed off (the gathered chip condenses into a drop that falls as the grid closes)
  const [step, setStep] = useState(0);
  // Swift hands off once the farthest chip has melted in: 440ms plus 40ms a place.
  const reach = Math.max(...CHIPS.map((_, i) => ripple(chosen, i)));
  useScript([
    [0, () => setStep(0)],
    [80, () => setStep(1)],
    [1900, () => setStep(2)],
    [2050, () => { setStep(3); popDisc(); }],
    [2050 + 440 + 40 * reach, () => setStep(4)],
  ], 3300);
  const shown = step >= 1, pressed = step === 2, picked = step >= 3, departed = step === 4;
  return (
    <Stage>
      <div className="absolute inset-x-0" style={{ top: "50%", transform: "translateY(-50%)" }}>
        {/* Closing: the grid shuts from its height once the chosen chip hands off, so the composer rises into its place.
            Nothing is clipped: by then the glass is one drop that closes as it falls. */}
        <div data-motion className="relative" style={{ height: departed ? 0 : pt(GRID_H, s), transition: step === 0 ? "none" : t("height", "dismiss") }}>
          {/* One glass group, so the chips melt into the chosen one, with no shadow under it. Glass never fades inside
              it: the arrival fades the whole group. */}
          <LiquidGroup unit={pt(1, s)} merge={CHIP_MELT} axis="both" lift={false} style={{ opacity: shown ? 1 : 0, transition: step === 0 ? "none" : t("opacity", "reveal") }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gap: pt(CHIP_GAP, s), padding: `${pt(8, s)} ${pt(16, s)}` }}>
              {CHIPS.map(([c, block, d], i) => {
                const me = i === chosen, melting = picked && !me, gone = melting || departed;
                // Home is the chosen chip's centre: whole columns and rows away. A column is the chip's own width plus
                // the gap, so it reads as a percentage of the chip.
                const cols = (chosen % COLS) - (i % COLS), rows = Math.floor(chosen / COLS) - Math.floor(i / COLS);
                // The look of each moment on its own clock: the arrival rises in reading order; the chosen chip swells
                // as the others flow home into it, shrinking as they go, then condenses into a drop that falls. Under
                // Reduce Motion nothing travels: the others close in place.
                const scale = departed ? 0.001 : melting ? (still ? 0.001 : liquid.homeScale) : still ? 1 : !shown ? 0.94 : me && pressed ? CHIP_PRESS : me && picked ? 1.04 : 1;
                const x = melting && !still ? `calc(${cols} * (100% + ${pt(CHIP_GAP, s)}))` : "0px";
                const y = still ? "0px" : !shown ? pt(12, s) : pt(melting ? rows * (CHIP_H + CHIP_GAP) : me && departed ? 24 : 0, s);
                // The melted chips sit wholly inside the chosen one by the hand-off, so they close at once and the drop
                // falls as a single shape.
                const transition = step === 0 || (departed && melting) ? "none"
                  : departed ? t("transform", "dismiss")
                  : melting ? t("transform", liquid.home, 40 * Math.max(ripple(chosen, i) - 1, 0))
                  : me && pressed ? t("transform", "press")
                  : me && picked ? t("transform", "success")
                  : t("transform", "reveal", 45 * i);
                return (
                  <Liquid key={c} radius="capsule" className="flex min-w-0" style={{ transform: `translate(${x}, ${y}) scale(${scale})`, transition, zIndex: me ? 1 : 0 }}>
                    {/* The content blurs away before the glass moves, so it never rides over the chosen chip's title. */}
                    <span className="flex w-full items-center whitespace-nowrap" style={{
                      height: pt(CHIP_H, s), paddingLeft: pt(10, s), paddingRight: pt(14, s), gap: pt(10, s), fontSize: pt(15, s), fontWeight: 600, color: ground.text,
                      opacity: gone ? 0 : 1, filter: `blur(${gone ? pt(6, s) : "0px"})`,
                      transition: step === 0 ? "none" : gone ? "opacity 140ms ease-out, filter 140ms ease-out" : "opacity 300ms ease-out 100ms, filter 300ms ease-out 100ms",
                    }}>
                      <span ref={me ? disc : undefined} className="grid shrink-0 place-items-center rounded-full" style={{ width: pt(32, s), height: pt(32, s), background: block, color: ink }}><Icon d={d} size={pt(14, s)} stroke={2.6} /></span>
                      <span className="truncate">{c}</span>
                    </span>
                  </Liquid>
                );
              })}
            </div>
          </LiquidGroup>
        </div>
      </div>
    </Stage>
  );
}

// MARK: Source Stack

/** Swift's example sources: title, site, detail, badge colour. */
const SOURCES: [string, string, string, string][] = [
  ["Why the old trams still run", "The Lisbon Review", "2 days ago", blocks.sky],
  ["Tram 28, stop by stop", "Tram Notes", "Updated May", blocks.butter],
  ["How the funiculars climb", "Hill & Harbour", "", blocks.sage],
  ["A short history of the tram", "City Rails Journal", "2019", blocks.lilac],
];
/** The pill shows this many badges; they fly into their cards. */
const STACKED = 3;
/** Layout in points: the pill, the cards and the gap between them, as the Swift piece lays them out. */
const SS = { w: 360, pill: 40, card: 62, gap: 8, small: 26, big: 32, overlap: 9 };
const SS_OPEN_H = SS.pill + SS.gap + SOURCES.length * SS.card + (SOURCES.length - 1) * SS.gap;
const PILL_PRESS = pressScale(150, 40), CARD_PRESS = pressScale(SS.w, SS.card);

/** Where badge `i` sits, in points from the column's top left: in the centred pill's stack (whose slot starts at
 *  `slot`), or on its card. */
const badgeAt = (i: number, open: boolean, slot: number) =>
  open ? { x: 12, y: SS.pill + SS.gap + i * (SS.card + SS.gap) + (SS.card - SS.big) / 2, size: SS.big } : { x: slot + i * (SS.small - SS.overlap), y: (SS.pill - SS.small) / 2, size: SS.small };

function SourceBadge({ s, site, color, size }: { s: number; site: string; color: string; size: number }) {
  return (
    <span className="grid place-items-center rounded-full" style={{ width: "100%", height: "100%", background: color, color: ink, border: `${pt(2, s)} solid ${ground.surface}`, fontFamily: font.rounded, fontSize: pt(size * 0.42, s), fontWeight: 700, lineHeight: 1 }}>
      {site[0]}
    </span>
  );
}

export function SourceStackPreview() {
  const s = 0.19;
  const still = useReduced();
  // Where the closed pill's badge slot starts, in points: the pill is centred, so it depends on the label's width.
  const pillRef = useRef<HTMLSpanElement>(null), colRef = useRef<HTMLDivElement>(null);
  const [slotX, setSlotX] = useState(96);
  useLayoutEffect(() => {
    const measure = () => {
      const pill = pillRef.current, col = colRef.current;
      const colW = col?.getBoundingClientRect().width ?? 0;
      if (!pill || !col || !colW) return;
      // Rects on both sides, so a scaled stage cancels out.
      const perPt = colW / SS.w;
      // Measured closed: the label and chevron's width, plus the slot and padding the closed pill has.
      // Rects, not offsetWidth: the chevron is an SVG. Unscaled by the pill's press, which is never on at mount.
      const label = pill.children[1].getBoundingClientRect().width + pill.children[2].getBoundingClientRect().width;
      const closedW = 7 + STACKED * SS.small - (STACKED - 1) * SS.overlap + 2 * 10 + label / perPt + 14;
      setSlotX(+((SS.w - closedW) / 2 + 7).toFixed(2));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (colRef.current) ro.observe(colRef.current);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, []);
  // 0 closed, 1 pill pressed, 2 open, 3 a card pressed, 4 open again, 5 pill pressed to close
  const [step, setStep] = useState(0);
  // The pill's badges fly on a per-frame spring rather than a CSS transition: Chrome can leave a transform transition
  // that starts as the stack closes parked at its first frame, stranding the badges where the cards were.
  const badgeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const badgePos = useRef<{ x: number; y: number; size: number }[] | null>(null);
  const place = (i: number, p: { x: number; y: number; size: number }) => {
    const el = badgeRefs.current[i];
    if (el) el.style.transform = `translate(${pt(p.x, s)}, ${pt(p.y, s)}) scale(${p.size / SS.big})`;
  };
  // Open, a card pressed, close, and again: the stack is always on its way somewhere.
  useScript([
    [0, () => setStep(0)],
    [900, () => setStep(1)],
    [1060, () => setStep(2)],
    [2600, () => setStep(3)],
    [2760, () => setStep(4)],
    [3900, () => setStep(5)],
    [4060, () => setStep(0)],
  ], 5200);
  const open = step >= 2 && step <= 5;
  useLayoutEffect(() => {
    const targets = SOURCES.slice(0, STACKED).map((_, i) => badgeAt(i, open, slotX));
    const from = badgePos.current;
    // First paint, or Reduce Motion: straight to the pose.
    if (!from || still) { badgePos.current = targets; targets.forEach((p, i) => place(i, p)); return; }
    const spring = roles[open ? "morph" : "dismiss"], total = settleTime(spring), start = performance.now();
    const origin = from.map((p) => ({ ...p }));
    let raf = 0;
    const tick = (now: number) => {
      const e = (now - start) / 1000, k = e >= total ? 1 : springValue(spring, e);
      badgePos.current = targets.map((tg, i) => {
        const f = origin[i];
        return { x: f.x + (tg.x - f.x) * k, y: f.y + (tg.y - f.y) * k, size: f.size + (tg.size - f.size) * k };
      });
      badgePos.current.forEach((p, i) => place(i, p));
      if (e < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slotX, still]);
  // The badges travel on the morph spring with a little give and come home on the quicker dismiss spring.
  const flight = open ? "morph" : "dismiss";
  const height = open ? SS_OPEN_H : SS.pill;
  const slot = STACKED * SS.small - (STACKED - 1) * SS.overlap;
  return (
    <Stage>
      {/* The column stays centred as it grows, like the Swift example, so it rises as the list opens. */}
      <div ref={colRef} data-motion className="absolute left-1/2 top-1/2 flex flex-col items-center" style={{ width: pt(SS.w, s), transform: `translate(-50%, ${pt(-height / 2, s)})`, transition: t("transform", flight) }}>
        <span
          ref={pillRef}
          data-motion
          className="relative inline-flex items-center rounded-full"
          style={{
            height: pt(SS.pill, s), paddingLeft: pt(open ? 16 : 7, s), paddingRight: pt(14, s), gap: pt(10, s), background: ground.surface,
            transform: step === 1 || step === 5 ? `scale(${PILL_PRESS})` : "none",
            transition: `${t("transform", step === 1 || step === 5 ? "press" : "release")}, ${t("padding-left", flight)}`,
          }}
        >
          {/* Room for the stack; the badges themselves fly on their own layer. */}
          <span data-motion style={{ width: pt(open ? 0 : slot, s), marginRight: pt(open ? -10 : 0, s), height: 1, transition: t(["width", "margin-right"], flight) }} />
          <span style={{ fontSize: pt(15, s), fontWeight: 600, whiteSpace: "nowrap" }}>{SOURCES.length} sources</span>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ width: pt(12, s), height: pt(12, s), color: ground.muted, transform: open ? "rotate(180deg)" : "none", transition: t("transform", "snap") }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
        {SOURCES.map(([title, site, detail, color], i) => {
          const pressed = step === 3 && i === 1;
          return (
            <div
              key={title}
              data-motion
              className="absolute left-0 flex items-center"
              style={{
                top: pt(SS.pill + SS.gap + i * (SS.card + SS.gap), s), width: "100%", height: pt(SS.card, s), padding: pt(12, s), gap: pt(12, s),
                borderRadius: pt(18, s), background: ground.surface,
                opacity: open ? 1 : 0,
                // The cards arrive one after another under the flying badges, rising as they fade in, and leave together.
                transform: `${open || still ? "translateY(0)" : `translateY(${pt(-10, s)})`} scale(${pressed ? CARD_PRESS : 1})`,
                transition: open
                  ? `${t("opacity", "reveal", 40 * i)}, ${t("transform", pressed ? "press" : step === 4 && i === 1 ? "release" : "reveal", pressed || step === 4 ? 0 : 40 * i)}`
                  : t(["opacity", "transform"], "dismiss"),
              }}
            >
              <span className="shrink-0" style={{ width: pt(SS.big, s), height: pt(SS.big, s) }}>
                {i >= STACKED ? <SourceBadge s={s} site={site} color={color} size={SS.big} /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col" style={{ gap: pt(2, s) }}>
                <span className="truncate" style={{ fontSize: pt(15, s), fontWeight: 600, lineHeight: 1.25 }}>{title}</span>
                <span className="truncate" style={{ fontSize: pt(12, s), fontWeight: 500, color: ground.muted }}>{[site, detail].filter(Boolean).join("  ·  ")}</span>
              </span>
              <span className="grid shrink-0 place-items-center rounded-full" style={{ width: pt(24, s), height: pt(24, s), fontSize: pt(12, s), fontWeight: 700, color: ground.muted, background: `color-mix(in srgb, ${ground.muted} 12%, transparent)`, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
            </div>
          );
        })}
        {/* The pill's badges, on their own layer: out of the stack into their cards, and home again. */}
        {SOURCES.slice(0, STACKED).map(([title, site, , color], i) => {
          return (
            <span
              key={title}
              ref={(el) => { badgeRefs.current[i] = el; }}
              data-motion
              className="absolute left-0 top-0"
              // Placed by the spring above, never by React, so a re-render can't snap a badge mid-flight.
              style={{ width: pt(SS.big, s), height: pt(SS.big, s), zIndex: STACKED - i, transformOrigin: "0 0" }}
            >
              <SourceBadge s={s} site={site} color={color} size={SS.big} />
            </span>
          );
        })}
      </div>
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
        <span className="text-[13px]" style={{ color: ground.muted, fontWeight: 600 }}>Thinking</span>
      </Center>
    </Stage>
  );
}

// MARK: Thought Orb

/** The Swift `ThoughtOrb.Palette` presets, same hex values: the mark's colour is the kind of work. */
const SEARCHING: OrbPalette = { bands: ["#2b5cff", "#22d3ee", "#34d399", "#7c3aed"], ground: "#06122a", cool: "#67e8f9", warm: "#a78bfa" };
const READING: OrbPalette = { bands: ["#4c1dff", "#a855f7", "#14b8a6", "#818cf8"], ground: "#0b0724", cool: "#c7d2fe", warm: "#99f6e4" };
const WRITING: OrbPalette = { bands: ["#e3170a", "#ffb020", "#ff4f8a", "#8b5cf6"], ground: "#1c0907", cool: "#ffcf7a", warm: "#ff5a3c" };
const STEPS: [string, OrbPalette][] = [["Thinking", SIRI], ["Searching sources", SEARCHING], ["Reading the thread", READING], ["Drafting a reply", WRITING]];
/** Swift's label beat: the letters, the capsule and the dots reshape together, quicker than morph for a toolbar pill. */
const PILL_BEAT: Spring = { duration: 0.3, bounce: 0.2 };
/** Swift's demo steps every 1.8s. */
const STEP_MS = 1800;
/** The Pill at its default 28pt mark: the label 0.47 of it, the glass a fifth of it around the mark. */
const MARK = 28, PILL_FONT = MARK * 0.47, PILL_H = MARK * 1.4;
/** The four dots and the gap before them, in points. */
const DOTS_W = PILL_FONT * (0.3 + 4 * 0.16 + 3 * 0.12);

/**
 * Hero mark over the status pill: the mark rides a round glass bubble joined by a liquid neck to the label's capsule.
 * The label morphs letter by letter into each new verb and the capsule reshapes around it in one beat, the dots riding
 * its end; the mark's colour follows on its own slower fade, and the motion never changes.
 */
export function ThoughtOrbPreview() {
  const s = 0.17, U = pt(1, s);
  const [step, setStep] = useState(0);
  const [clock] = useClock();
  useScript(STEPS.map((_, i): [number, () => void] => [i * STEP_MS, () => setStep(i)]), STEPS.length * STEP_MS);
  const [em, measure] = useEmWidths(STEPS.map(([label]) => label), [3.6, 7.6, 7.8, 7]);
  // The capsule's width springs to each verb, so its glass reshapes in one beat; the dots ride its end.
  const capsule = MARK * 0.5 + em[step] * PILL_FONT + DOTS_W + MARK * 0.55;
  const inset = (PILL_H - MARK) / 2;
  // Each dot rises and falls on an eased curve over the first 60% of its cycle, then rests, from the left.
  const dotOpacity = (i: number) => { let p = ((clock - i * 0.12) / 1.6) % 1; if (p < 0) p += 1; return p < 0.6 ? 0.28 + 0.72 * Math.sin((p / 0.6) * Math.PI) ** 2 : 0.28; };
  return (
    <Stage>
      <Center className="flex-col gap-5">
        <SiriWaveOrb size="min(38cqw, 50cqh)" palette={STEPS[step][1]} />
        <span aria-hidden className="pointer-events-none absolute" style={{ fontSize: pt(PILL_FONT, s), fontWeight: 600 }}>{measure}</span>
        <div className="relative">
          <LiquidGroup unit={U}>
            {/* Two parts of one control, so they rest joined: the neck between the bubble and the capsule holds. */}
            <div className="flex items-center" style={{ gap: pt(liquid.joined, s) }}>
              <Liquid radius="capsule" style={{ width: pt(PILL_H, s), height: pt(PILL_H, s), flexShrink: 0 }} />
              <Liquid radius="capsule" className="flex items-center whitespace-nowrap" style={{ height: pt(PILL_H, s), width: pt(capsule, s), paddingLeft: pt(MARK * 0.5, s), paddingRight: pt(MARK * 0.55, s), fontSize: pt(PILL_FONT, s), fontWeight: 600, color: `color-mix(in srgb, ${ground.text} 85%, transparent)`, transition: t("width", PILL_BEAT) }}>
                <MorphText text={STEPS[step][0]} />
                <span className="flex shrink-0" style={{ marginLeft: "auto", paddingLeft: pt(PILL_FONT * 0.3, s), gap: pt(PILL_FONT * 0.12, s) }} aria-hidden>
                  {[0, 1, 2, 3].map((i) => <span key={i} data-motion className="rounded-full" style={{ width: pt(PILL_FONT * 0.16, s), height: pt(PILL_FONT * 0.16, s), background: ground.text, opacity: dotOpacity(i) }} />)}
                </span>
              </Liquid>
            </div>
          </LiquidGroup>
          {/* The mark sits in its bubble, drawn once over the glass: a shader ball is never glass on glass. */}
          <span className="pointer-events-none absolute" style={{ left: pt(inset, s), top: pt(inset, s) }}>
            <SiriWaveOrb size={pt(MARK, s)} palette={STEPS[step][1]} />
          </span>
        </div>
      </Center>
    </Stage>
  );
}
