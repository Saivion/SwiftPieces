"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { font, ground, signal } from "./palette";
import { follow, pressScale, t } from "./piece-motion";
import { Liquid, LiquidGroup, MorphText, glass, liquid } from "./piece-liquid";

/*
 * Scroll Island, as the Swift piece: a floating liquid glass island over a long page. It names the section in view,
 * rings it in red with how much has been read, buds a joined back-to-top bubble once the reader leaves the first
 * section, and grows in place into the page's contents, where a red puck stretches from row to row under the finger.
 * The page behind is plain placeholder blocks (a heading bar and paragraph lines per section), only so the island has
 * something to float over. Sizes are authored in px against the 560 px stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

/** The recipe the island reads: titles and reading times, and the placeholder lines each section draws. */
const SECTIONS = [
  { title: "Overview", detail: "1 min", lines: [1, 0.94, 0.98, 0.62, 0.86] },
  { title: "Ingredients", detail: "2 min", lines: [0.96, 1, 0.88, 0.54, 1, 0.92, 0.97, 0.7] },
  { title: "Method", detail: "5 min", lines: [1, 0.9, 0.97, 1, 0.66, 0.94, 1, 0.88, 0.5, 0.8] },
  { title: "Serving", detail: "2 min", lines: [0.98, 1, 0.84, 0.58, 0.92, 0.46] },
  { title: "Notes", detail: "1 min", lines: [1, 0.9, 0.62, 0.86, 0.38] },
] as const;

/** The placeholder page: a heading bar over paragraph lines per section, with room below to scroll the last one up. */
const PAGE = { pad: 30, heading: 16, headingGap: 14, line: 9, lineGap: 11, sectionGap: 30, tail: 300, width: 470 };
const sectionTop = (() => {
  const tops: number[] = [];
  let y = PAGE.pad;
  for (const s of SECTIONS) {
    tops.push(y);
    y += PAGE.heading + PAGE.headingGap + s.lines.length * (PAGE.line + PAGE.lineGap) - PAGE.lineGap + PAGE.sectionGap;
  }
  return tops;
})();
const STAGE_H = 420;
const PAGE_H = sectionTop[sectionTop.length - 1] + 140 + PAGE.tail;
/** Where the page sits when a section is scrolled to the top, a little below the edge, as `scrollPosition(anchor: .top)`. */
const at = (i: number) => sectionTop[i] - 18;
/** How much has been read: the scroll offset over the whole travel, as the piece's `onScrollGeometryChange` example. */
const readAt = (scroll: number) => Math.min(Math.max(scroll / (PAGE_H - STAGE_H), 0), 1);

/** The island's metrics in points, as the Swift piece: a 48 pt bar, a 26 pt ring, 44 pt rows, a panel up to 360 wide. */
const BAR = 48, RING = 26, STROKE = 2.5, ROW = 44, INSET = 6, GAP_ROWS = 2, PANEL_W = 360, BOTTOM = 18;
const PANEL_H = BAR + INSET + SECTIONS.length * ROW + GAP_ROWS;
/** The bubble's room beside the island while it is out: its width and a joined neck. */
const ROOM = BAR + liquid.joined;
const STAGE_W = 560;

/** Where the finger is: on the island, on a row of the open contents, or on the back-to-top bubble. */
type Target = "island" | "top" | { row: number };

/**
 * The loop. `scroll` is the page's offset in px, reached by a finger-paced scroll (`move: "track"`, linear over the
 * step) or a jump to a section (`move: "jump"`, the no-overshoot value spring). `section` is the section the island
 * shows, `open` the contents, `top` the back-to-top bubble, `puck` the row under the finger while the contents are open,
 * `press` what the finger holds down and `finger` where it is (absent when lifted). The finger is not drawn (what it
 * holds shows the touch); it places the finger in the launch video.
 */
type Step = { ms: number; scroll: number; move?: "track" | "jump"; section: number; open: boolean; top: boolean; puck?: number; press?: "island" | "top"; finger?: Target; note: string };
const REST = 64;
const steps: readonly Step[] = [
  { ms: 1500, scroll: REST, section: 0, open: false, top: false, note: "Rest: Overview, 1 of 5, the ring just started." },
  { ms: 900, scroll: 112, move: "track", section: 0, open: false, top: false, note: "The page scrolls; the ring grows with it." },
  { ms: 800, scroll: at(1), move: "track", section: 1, open: false, top: true, note: "Ingredients reaches the top: the title morphs, the back-to-top bubble buds out joined." },
  { ms: 700, scroll: at(1), section: 1, open: false, top: true, note: "" },
  { ms: 160, scroll: at(1), section: 1, open: false, top: true, press: "island", finger: "island", note: "A tap: the island dips under the finger." },
  { ms: 1100, scroll: at(1), section: 1, open: true, top: false, note: "It grows in place into the contents; the bubble melts home, the rows arrive after the glass." },
  { ms: 300, scroll: at(1), section: 1, open: true, top: false, puck: 1, finger: { row: 1 }, note: "A finger lands on Ingredients, under the puck." },
  { ms: 380, scroll: at(1), section: 1, open: true, top: false, puck: 2, finger: { row: 2 }, note: "It slides down: the puck stretches to Method and gathers on it." },
  { ms: 380, scroll: at(1), section: 1, open: true, top: false, puck: 3, finger: { row: 3 }, note: "On to Serving." },
  { ms: 300, scroll: at(1), section: 1, open: true, top: false, puck: 3, finger: { row: 3 }, note: "" },
  { ms: 450, scroll: at(3), move: "jump", section: 3, open: false, top: false, note: "Let go: the contents melt back into the pill, which reads Serving, and the page jumps there." },
  { ms: 1050, scroll: at(3), section: 3, open: false, top: true, note: "The bubble buds back out once the glass has settled." },
  { ms: 160, scroll: at(3), section: 3, open: false, top: true, press: "top", finger: "top", note: "The bubble dips under a tap." },
  { ms: 1700, scroll: REST, move: "jump", section: 0, open: false, top: false, note: "Back to the top: Overview morphs in and the bubble melts home. Rest." },
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

/** Walks the steps; each holds for `ms`, then the loop goes on. Holds the rest under reduced motion. */
function useSteps<T extends { ms: number }>(list: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const timer = setTimeout(() => setI((v) => (v + 1) % list.length), list[i].ms);
    return () => clearTimeout(timer);
  }, [i, list, reduced]);
  return { step: list[i], prev: list[(i + list.length - 1) % list.length] };
}

/** SF Symbols the piece draws: `arrow.up` and `chevron.up`. */
const glyphs = { arrowUp: "M12 19V5M5.5 11.5L12 5l6.5 6.5", chevronUp: "M6 15l6-6 6 6" } as const;

function Glyph({ name, size, stroke = 2.4, style }: { name: keyof typeof glyphs; size: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0, ...style }}>
      <path d={glyphs[name]} />
    </svg>
  );
}

/** One of the bar's two label layers: blurs out quickly as it gives way and in a beat later once the glass has grown. */
const fade = (shown: boolean): CSSProperties => ({
  opacity: shown ? 1 : 0,
  filter: `blur(${shown ? 0 : 5}px)`,
  transition: shown ? "opacity 240ms ease-out 200ms, filter 240ms ease-out 200ms" : "opacity 120ms ease-out, filter 120ms ease-out",
});

/** The puck's two edges, registered so each can spring on its own transition, and inherited so its ink rows follow. */
const puckProperties = "@property --si-top{syntax:'<length>';inherits:true;initial-value:0px}@property --si-bot{syntax:'<length>';inherits:true;initial-value:0px}";

const position = (i: number) => `${i + 1} of ${SECTIONS.length}`;
const percent = (f: number) => `${Math.round(f * 100)}% read`;

/** The contents' rows in one ink: the page's colours on the glass, or the puck's ink on red. */
function Rows({ onPuck }: { onPuck: boolean }) {
  const primary = onPuck ? signal.on : ground.text;
  const secondary = onPuck ? "rgba(20,20,20,.62)" : ground.muted;
  return (
    <>
      {SECTIONS.map((s, i) => (
        <span key={s.title} className="flex items-center whitespace-nowrap" style={{ height: u(ROW), paddingInline: u(14), gap: u(12) }}>
          <span className="tabular-nums" style={{ width: u(10), fontSize: u(13), color: secondary }}>{i + 1}</span>
          <span style={{ fontSize: u(17), color: primary }}>{s.title}</span>
          <span className="flex-1" />
          <span style={{ fontSize: u(13), color: secondary }}>{s.detail}</span>
        </span>
      ))}
    </>
  );
}

/** The read ring: a red arc over a quiet track, from the top. */
function Ring({ fraction, transition }: { fraction: number; transition: string }) {
  const r = (RING - STROKE) / 2, c = 2 * Math.PI * r;
  return (
    <svg aria-hidden viewBox={`0 0 ${RING} ${RING}`} style={{ width: u(RING), height: u(RING), flexShrink: 0, transform: "rotate(-90deg)" }}>
      <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" strokeWidth={STROKE} stroke={`color-mix(in srgb, ${ground.muted} 34%, ${glass.solid})`} />
      <circle data-motion cx={RING / 2} cy={RING / 2} r={r} fill="none" strokeWidth={STROKE} stroke={signal.fill} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - fraction)} style={{ transition }} />
    </svg>
  );
}

export function ScrollIslandPreview() {
  const { step, prev } = useSteps(steps);
  // Titles and positions are measured once in px at the 560 stage, so the closed island can hug its label.
  const [widths, setWidths] = useState<number[] | null>(null);
  const measure = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    let alive = true;
    const read = () => {
      const one = (el.offsetWidth || 1) / 100;
      if (alive) setWidths(Array.from(el.children).slice(1).map((n) => Math.round(((n as HTMLElement).offsetWidth / one) * 10) / 10));
    };
    read();
    document.fonts?.ready.then(read);
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => { alive = false; ro.disconnect(); };
  }, []);
  const titleW = (i: number) => widths?.[i] ?? SECTIONS[i].title.length * 9.4;
  const positionW = (i: number) => widths?.[SECTIONS.length + i] ?? 42;
  /** The closed island hugs its bar: ring, title, position and chevron with the piece's own spacing. */
  const hug = (i: number) => Math.ceil(11 + RING + 10 + titleW(i) + 20 + positionW(i) + 6 + 12 + 16) + 1;

  const open = step.open;
  const width = open ? PANEL_W : hug(step.section);
  const height = open ? PANEL_H : BAR;
  const shift = step.top && !open ? ROOM / 2 : 0;
  const islandX = (STAGE_W - width) / 2 + shift;
  // The glass grows on the calm spring and closes quick and firm, a beat after the rows have gone.
  const opened = open !== prev.open;
  const shape = open ? t(["width", "height", "border-radius"], "reveal") : t(["width", "height", "border-radius"], "dismiss", opened ? 80 : 0);
  // The island's place: with the glass while it opens or closes, with the bubble while it buds or melts, and on the
  // morph spring when a new title changes its width.
  const placeT = opened ? (open ? t("transform", "reveal") : t("transform", "dismiss", 80)) : step.top !== prev.top ? t("transform", step.top ? liquid.split : liquid.home) : t("transform", "morph");
  // The page and the ring keep pace with a finger-paced scroll and land on the value spring after a jump.
  const scrollT = step.move === "track" ? `transform ${step.ms}ms linear` : step.move === "jump" ? t("transform", "value") : "none";
  const ringT = step.move === "track" ? `stroke-dashoffset ${step.ms}ms linear` : t("stroke-dashoffset", "value");
  const read = readAt(step.scroll);
  // The panel's own reading holds while it fades out, so a jump on release never flips it under the reader.
  const panelRead = open || !prev.open ? read : readAt(prev.scroll);

  // The puck: the row under the finger while the contents are open, the section otherwise. The edge facing the new row
  // leads on the snap spring and the far edge follows a beat behind, so it stretches toward the row and gathers on it.
  const puck = step.puck ?? step.section;
  const from = prev.puck ?? prev.section;
  const down = puck >= from;
  const trail = follow("snap", 2);
  const puckT = open && prev.open ? [t("--si-bot", down ? "snap" : trail), t("--si-top", down ? trail : "snap")].join(", ") : "none";

  // The rows arrive once the glass has grown and leave before it shrinks.
  const rowsT = open ? "opacity 260ms ease-out 160ms" : "opacity 120ms ease-out";

  const pressIsland = step.press === "island";
  const pressTop = step.press === "top";
  const rowsH = SECTIONS.length * ROW;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, fontWeight: 600, color: ground.text }}>
      <style>{puckProperties}</style>
      {/* Plain placeholder content, only so the island has something to float over. */}
      <div aria-hidden data-motion className="absolute left-1/2 top-0" style={{ width: u(PAGE.width), height: u(PAGE_H), marginLeft: u(-PAGE.width / 2), transform: `translateY(${u(-step.scroll)})`, transition: scrollT }}>
        {SECTIONS.map((s, i) => (
          <div key={s.title} className="absolute left-0 right-0 flex flex-col" style={{ top: u(sectionTop[i]), gap: u(PAGE.lineGap) }}>
            <span className="block" style={{ width: u(150), height: u(PAGE.heading), borderRadius: u(8), background: ground.control, marginBottom: u(PAGE.headingGap - PAGE.lineGap) }} />
            {s.lines.map((w, k) => <span key={k} className="block" style={{ width: `${w * 100}%`, height: u(PAGE.line), borderRadius: u(5), background: ground.raised }} />)}
          </div>
        ))}
      </div>

      {/* The labels, laid out once off stage to be measured in px at the 560 stage. */}
      <div ref={measure} aria-hidden className="pointer-events-none absolute left-0 top-0" style={{ visibility: "hidden", width: u(100) }}>
        <span />
        {SECTIONS.map((s) => <span key={s.title} className="absolute whitespace-nowrap" style={{ fontSize: u(17) }}>{s.title}</span>)}
        {SECTIONS.map((s, i) => <span key={s.title} className="absolute whitespace-nowrap tabular-nums" style={{ fontSize: u(13) }}>{position(i)}</span>)}
      </div>

      <LiquidGroup unit={u(1)} style={{ position: "absolute", left: 0, bottom: u(BOTTOM), width: u(STAGE_W), height: u(PANEL_H) }}>
        {/* The back-to-top bubble, first so it slips under the island going home. It rests joined to the island's
            leading end and melts into it, shrunk, while the reader is in the first section or the contents are open. */}
        <span data-motion className="absolute bottom-0 left-0" style={{ width: u(BAR), height: u(BAR), transform: `translateX(${u(islandX - ROOM)})`, transition: placeT }}>
          <span data-motion className="block h-full w-full" style={{ transform: `scale(${pressTop ? pressScale(BAR, BAR) : 1})`, transition: t("transform", pressTop ? "press" : "release") }}>
            <Liquid bud={{ out: step.top, home: [liquid.joined + BAR / 2 + (BAR * liquid.homeScale) / 2, 0] }} className="flex h-full w-full items-center justify-center" style={{ color: ground.text }}>
              <span className="flex" style={fade(step.top)}><Glyph name="arrowUp" size={18} stroke={2.4} /></span>
            </Liquid>
          </span>
        </span>

        {/* The island: one glass shape that hugs its bar while closed and grows upward into the contents while open. */}
        <span data-motion className="absolute bottom-0 left-0" style={{ transform: `translateX(${u(islandX)})`, transition: placeT }}>
          <span data-motion className="block" style={{ transform: `scale(${pressIsland ? pressScale(width, height) : 1})`, transformOrigin: "50% 100%", transition: t("transform", pressIsland ? "press" : "release") }}>
            <Liquid radius={open ? 26 : BAR / 2} className="relative overflow-hidden" style={{ width: u(width), height: u(height), transition: shape }}>
              {/* The contents, laid out at the panel's width whatever the island's, so nothing reflows as it grows. */}
              <span className="absolute left-1/2" style={{ bottom: u(BAR + GAP_ROWS), width: u(PANEL_W - INSET * 2), height: u(rowsH), marginLeft: u(-(PANEL_W - INSET * 2) / 2), opacity: open ? 1 : 0, transition: rowsT }}>
                <span className="absolute inset-0 flex flex-col"><Rows onPuck={false} /></span>
                {/* The red puck, with the rows in ink cut to its outline, so a title turns exactly under its edge. */}
                <span data-motion className="absolute left-0 right-0 overflow-hidden" style={{
                  ["--si-top" as string]: u(puck * ROW), ["--si-bot" as string]: u((puck + 1) * ROW),
                  top: "var(--si-top)", height: "calc(var(--si-bot) - var(--si-top))", borderRadius: u(ROW / 2), background: signal.fill, transition: puckT,
                } as CSSProperties}>
                  <span className="absolute left-0 right-0 flex flex-col" style={{ top: "calc(var(--si-top) * -1)" }}><Rows onPuck /></span>
                </span>
              </span>
              <span className="absolute bottom-0 left-0 right-0 flex items-center" style={{ height: u(BAR), paddingLeft: u((BAR - RING) / 2), paddingRight: u(16), gap: u(10) }}>
                <Ring fraction={read} transition={ringT} />
                <span className="relative whitespace-nowrap" style={{ fontSize: u(17), lineHeight: 1 }}>
                  <span style={{ display: "inline-flex", ...fade(!open) }}><MorphText text={SECTIONS[step.section].title} /></span>
                  <span className="absolute left-0 top-0" style={fade(open)}>Contents</span>
                </span>
                <span className="flex-1" style={{ marginLeft: u(10) }} />
                <span className="flex items-center" style={{ gap: u(6), color: ground.muted }}>
                  <span className="relative tabular-nums whitespace-nowrap" style={{ fontSize: u(13), lineHeight: 1 }}>
                    <span style={{ display: "inline-flex", ...fade(!open) }}><MorphText text={position(step.section)} /></span>
                    <span className="absolute right-0 top-0" style={fade(open)}>{percent(panelRead)}</span>
                  </span>
                  <Glyph name="chevronUp" size={12} stroke={2.6} style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: t("transform", open ? "reveal" : "dismiss") }} />
                </span>
              </span>
            </Liquid>
          </span>
        </span>
      </LiquidGroup>

    </div>
  );
}

