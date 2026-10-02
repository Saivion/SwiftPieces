"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { PreviewFrame } from "@/components/previews/frame";
import { Parallax, Stage, Tilt } from "@/components/sections/stage";
import { IPhone } from "@/components/visual/iphone";
import { SkeletonChips, SkeletonHeader, SkeletonRow } from "@/components/visual/skeleton";
import { PiecePreview } from "@/components/previews";
import { useInView } from "@/lib/use-in-view";

/**
 * The agent row's visual: a short conversation that builds a piece. It opens mid-conversation,
 * with the first ask already sent and the Scrub Chart it added running. Each next ask is typed
 * into the chat, the cursor clicks send, the message joins the thread with the agent's reply, and
 * the change lands on the chart: its accent, then its corners. After the last change it holds and
 * returns to the opening state.
 *
 * The restyles go through ScrubChartPreview's own variables: the colour scheme (`--scrub-accent`,
 * `--scrub-line`, `--scrub-surface`, `--scrub-raised`, `--scrub-chip`, registered in globals.css so
 * the whole scheme cross-fades) and `--scrub-radius`. Runs only while on screen; reduced
 * motion shows the finished chart and thread.
 */
const TURNS = [
  { ask: "Add a chart I can scrub with my thumb", reply: "Added Scrub Chart" },
  { ask: "Update the chart's color scheme to red", reply: "Color scheme updated" },
  { ask: "Square off the corners", reply: "Corner radius 30 → 0" },
] as const;

/**
 * The scheme the second turn applies. Crimson, not brick: a cool wine-black card, a vivid
 * rose-red accent and a blush line, so the red reads rich rather than brown.
 */
const RED_SCHEME = {
  "--scrub-accent": "#ff2d55",
  "--scrub-line": "#ffc2cf",
  "--scrub-surface": "#1f0a11",
  "--scrub-raised": "#3a1120",
  "--scrub-chip": "#ff8fa6",
  "--scrub-down": "#ff5c7a",
} as const;

type Cursor = "off" | "rest" | "aim" | "press";


export function AgentDemo() {
  const root = useRef<HTMLDivElement>(null);
  const send = useRef<HTMLSpanElement>(null);
  // The chat card's layer: the cursor lives in it, so both move together with the pointer.
  const layer = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "0px 0px -15% 0px" });
  const [reduced, setReduced] = useState(false);
  const [draft, setDraft] = useState("");
  // The opening state: the first turn is already sent and applied.
  const [sent, setSent] = useState(1); // messages in the thread
  const [applied, setApplied] = useState(1); // changes landed on the chart
  const [cursor, setCursor] = useState<Cursor>("off");
  const [aimAt, setAimAt] = useState({ x: 0, y: 0 });

  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);

  // Where the send button's centre sits inside the stage, for the cursor to travel to.
  useLayoutEffect(() => {
    const measure = () => {
      const s = send.current, r = layer.current;
      if (!s || !r) return;
      const a = s.getBoundingClientRect(), b = r.getBoundingClientRect();
      setAimAt({ x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // The script. Leaving the viewport stops it and returns to the opening state.
  useEffect(() => {
    const clear = () => { setDraft(""); setSent(1); setApplied(1); setCursor("off"); };
    if (reduced) { setSent(TURNS.length); setApplied(TURNS.length); return; }
    if (!inView) { clear(); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const run = () => {
      clear();
      let t = 1600;
      TURNS.forEach((turn, i) => {
        if (i === 0) return; // already sent: the conversation opens here
        turn.ask.split("").forEach((_, k) => at(t + k * 38, () => setDraft(turn.ask.slice(0, k + 1))));
        t += turn.ask.length * 38 + 250;
        at(t, () => setCursor("aim"));
        t += 850;
        at(t, () => setCursor("press"));
        t += 160;
        at(t, () => { setDraft(""); setSent(i + 1); setCursor("rest"); });
        t += 450;
        at(t, () => setApplied(i + 1));
        t += 1500;
      });
      at(t, () => setCursor("off"));
      t += 3800;
      at(t, run);
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced]);

  const chart: CSSProperties & Record<string, string | number | undefined> = {
    opacity: applied >= 1 ? 1 : 0,
    transform: applied >= 1 ? "none" : "translateY(10px) scale(0.97)",
    // The red scheme: every colour in the chart moves, not just the accent.
    ...(applied >= 2 ? RED_SCHEME : {}),
    "--scrub-radius": applied >= 3 ? "0px" : undefined,
  };

  return (
    <div ref={root}>
    <Tilt className="relative">
      {/* The piece: an iPhone rising out of the stage, running the chart the conversation builds. */}
      <Stage className="h-[460px] sm:h-[540px]">
        <div className="absolute inset-x-0 top-10 flex justify-center sm:top-12 md:justify-start md:pl-[12%]">
          <Parallax depth={-7} className="w-[264px] sm:w-[284px]">
            {/* A skeleton finance app; the chart is the piece the conversation builds. */}
            <IPhone>
              <SkeletonHeader />
              <div className="relative z-10 h-[232px] shrink-0">
                <div className="scrub-tint absolute inset-x-[-4%] top-0 transition-[opacity,transform] duration-500 ease-out" style={chart}>
                  <PreviewFrame tone="clear" aspect="aspect-[4/3]" className="rounded-none!">
                    {applied >= 1 ? <PiecePreview name="ScrubChart" /> : null}
                  </PreviewFrame>
                </div>
              </div>
              <SkeletonChips widths={[64, 54, 70]} className="mt-1 mb-2" />
              <SkeletonRow />
              <SkeletonRow />
            </IPhone>
          </Parallax>
        </div>
      </Stage>

      {/* The chat: a card floating over the stage's right edge from md up, under it on phones. The thread
          fills from the bottom and the composer sits under it. */}
      <Parallax depth={18} className="relative z-10 mt-3 md:absolute md:top-[88px] md:-right-6 md:mt-0 md:w-[290px]">
      <div ref={layer} className="relative">
      <div className="flex h-[340px] flex-col overflow-hidden rounded-[12px] border border-white/[0.09] bg-[var(--raised)] shadow-[0_40px_80px_-28px_rgb(0_0_0/0.8),0_12px_28px_-14px_rgb(0_0_0/0.5)]" style={{ rotate: "1.5deg" }}>
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-3">
          <span className="grid size-6 place-items-center rounded-[7px] bg-accent text-[var(--accent-foreground)]">
            <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="currentColor"><path d="M12 2c.4 4.8 2.2 7.6 8 10-5.8 2.4-7.6 5.2-8 10-.4-4.8-2.2-7.6-8-10 5.8-2.4 7.6-5.2 8-10Z" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium text-foreground">Your agent</span>
            <span className="block text-[11px] text-muted">Swift Pieces MCP</span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted"><span className="size-1.5 rounded-full bg-[#28c840]" />Connected</span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-2.5 overflow-hidden px-4 pt-3">
          {TURNS.slice(0, sent).map((turn, i) => (
            <div key={turn.ask} className="chat-in flex flex-col items-end gap-1">
              <p className="max-w-[92%] rounded-[12px] rounded-br-[4px] bg-white/[0.08] px-3 py-2 text-[12.5px] leading-[18px] text-foreground">{turn.ask}</p>
              <p className="flex items-center gap-1.5 pr-1 text-[11.5px] text-muted transition-opacity duration-300" style={{ opacity: applied > i ? 1 : 0 }}>
                <svg aria-hidden viewBox="0 0 16 16" className="size-3 text-accent" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {turn.reply}
              </p>
            </div>
          ))}
        </div>
        <div className="m-3 flex h-11 shrink-0 items-center justify-between gap-3 rounded-[10px] border border-white/[0.08] bg-white/[0.03] pr-1.5 pl-3.5 text-[12.5px]">
          <span className="truncate text-foreground">
            {draft || <span className="text-muted">Ask your agent</span>}
            {draft ? <span aria-hidden className="ml-px inline-block h-[1.1em] w-px translate-y-[0.2em] bg-foreground" /> : null}
          </span>
          <span ref={send} className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-black transition-transform duration-150" style={{ transform: cursor === "press" ? "scale(0.84)" : "none" }}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          </span>
        </div>
      </div>
      {/* The cursor: rests just off the send button between messages, glides onto it to press. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-0 left-0 z-10 size-6 drop-shadow-[0_2px_6px_rgb(0_0_0/0.6)] transition-[transform,opacity] ease-[cubic-bezier(0.45,0,0.2,1)]"
        style={{
          transitionDuration: cursor === "press" ? "150ms" : "800ms",
          opacity: cursor === "off" ? 0 : 1,
          transform:
            cursor === "aim" || cursor === "press"
              ? `translate(${aimAt.x - 4}px, ${aimAt.y - 3}px) scale(${cursor === "press" ? 0.84 : 1})`
              : cursor === "rest"
                ? `translate(${aimAt.x - 40}px, ${aimAt.y + 26}px)`
                : `translate(${aimAt.x + 70}px, ${aimAt.y + 60}px)`,
        }}
      >
        <path d="M5 3l14 8-6 1.6L10 19 5 3Z" fill="#fff" stroke="#000" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      </div>
      </Parallax>


    </Tilt>
    </div>
  );
}
