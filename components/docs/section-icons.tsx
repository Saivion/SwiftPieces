import type { CSSProperties, ReactNode } from "react";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * 16px glyphs, drawn as separate parts so each can move on its own when its row is pointed at
 * (the .ai-* classes in app/globals.css): the grid's tiles pop in turn, the phone tilts, the
 * template's top bar settles, the Build Kit spark twinkles.
 */
const grid16: Record<string, { motion?: string; parts: ReactNode }> = {
  components: { parts: <>{[[3, 3], [9, 3], [3, 9], [9, 9]].map(([x, y], n) => <rect key={n} className="ai-pop" style={i(n)} x={x} y={y} width="4" height="4" />)}</> },
  blocks: { parts: <><rect className="ai-pop" x="2.5" y="4.5" width="11" height="3" /><rect className="ai-pop" style={i(1)} x="2.5" y="9.5" width="5" height="3" /><rect className="ai-pop" style={i(2)} x="9.5" y="9.5" width="4" height="3" /></> },
  screens: { motion: "ai-tilt", parts: <path d="M4 2.5h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM6 12h4" /> },
  // Two screens and the step between them; the path redraws when its row is pointed at. Same as Pro's.
  flows: { parts: <><rect x="1.5" y="3" width="4.5" height="10" rx="1" /><rect x="10" y="3" width="4.5" height="10" rx="1" /><path className="ai-redraw" pathLength={1} d="M6.5 8h3M8.2 6.6 9.6 8l-1.4 1.4" strokeLinecap="round" /></> },
  templates: { parts: <><rect className="ai-drop" x="2.5" y="3.5" width="11" height="2" /><rect x="2.5" y="7.5" width="11" height="5" /></> },
  agent: { parts: <path className="ai-twinkle" d="M8 2l1.2 3.3L12.5 6.5 9.2 7.8 8 11 6.8 7.8 3.5 6.5l3.3-1.2z" /> },
  free: { parts: <><path d="M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" /><path className="ai-spin" style={{ "--ai-turn": "180deg" } as CSSProperties} d="M5.5 8h5" /></> },
  collections: { parts: <>{["M3 5.5h10", "M3 8h10", "M3 10.5h6", "M5.5 3v10"].map((d, n) => <path key={d} className="ai-redraw" style={i(n)} pathLength={1} d={d} />)}</> },
  // The navbar's Resources: an open book whose right page turns, a compass whose needle swings, a
  // clock whose hand sweeps (the changelog), a terminal whose cursor blinks (MCP and agents), and a
  // heart that beats (sponsors).
  docs: { parts: <><path d="M8 4.5c-1.4-1-3.2-1.5-5.5-1.5v9c2.3 0 4.1.5 5.5 1.5" /><path className="ai-tilt" d="M8 4.5c1.4-1 3.2-1.5 5.5-1.5v9c-2.3 0-4.1.5-5.5 1.5z" /></> },
  guides: { parts: <><circle cx="8" cy="8" r="5.5" /><path className="ai-spin" style={{ "--ai-turn": "90deg" } as CSSProperties} d="M10 6l-1.2 2.8L6 10l1.2-2.8z" /></> },
  changelog: { parts: <><path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8" strokeLinecap="round" /><path d="M2.5 2.8v2.4h2.4" strokeLinecap="round" strokeLinejoin="round" /><path className="ai-spin" style={{ "--ai-turn": "360deg", transformOrigin: "8px 8px", transformBox: "view-box" } as CSSProperties} d="M8 5.2V8l1.9 1.2" strokeLinecap="round" /></> },
  mcp: { parts: <><rect x="2" y="3" width="12" height="10" rx="1.6" /><path d="M4.8 6.4l1.8 1.6-1.8 1.6" strokeLinecap="round" strokeLinejoin="round" /><path className="ai-pop" d="M8.4 9.8h2.8" strokeLinecap="round" /></> },
  sponsors: { motion: "ai-beat", parts: <path d="M8 13s-5-3-5-6.6A2.6 2.6 0 0 1 8 5.1a2.6 2.6 0 0 1 5 1.3C13 10 8 13 8 13z" /> },
};

/**
 * Icons drawn on Lucide's 24px grid (ISC licence), kept as separate paths because several start with a
 * relative move that would shift if merged into one. The stroke is scaled so they read at the same
 * weight as the 16px set: 1.3 x 24/16.
 */
const grid24: Record<string, string[][]> = {
  // Lucide "pencil-ruler": the Playground, where you try, take apart and remix native UI. The ruler
  // stays put and the pencil tilts, as if drawing.
  playground: [
    [
      "M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13",
      "m8 6 2-2",
      "m18 16 2-2",
      "m17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17",
    ],
    [
      "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
      "m15 5 4 4",
    ],
  ],
  // Lucide "palette": Styles, where one style for every screen is made. The palette stays put and its
  // dabs of paint lift off it on hover.
  style: [
    ["M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"],
    ["M13.5 6.5h.01", "M17.5 10.5h.01", "M8.5 7.5h.01", "M6.5 12.5h.01"],
  ],
  // Lucide "boxes": the whole library, every kind of piece stacked together. Three boxes: the
  // bottom two, then the top one, which lifts off the stack on hover.
  library: [
    [
      "M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z",
      "m7 16.5-4.74-2.85",
      "m7 16.5 5-3",
      "M7 16.5v5.17",
      "M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z",
      "m17 16.5-5-3",
      "m17 16.5 4.74-2.85",
      "M17 16.5v5.17",
    ],
    [
      "M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z",
      "M12 8 7.26 5.15",
      "m12 8 4.74-2.85",
      "M12 13.5V8",
    ],
  ],
};

/**
 * Bare 16px glyph. Fumadocs supplies the icon container in the section switcher, so this must not add
 * its own box. `tone` sets the colour; "text-current" follows the surrounding text (an active row).
 * The glyph animates when the link or row it sits in is hovered, focused or becomes current.
 */
export function SectionIcon({ kind, tone = "text-foreground" }: { kind: keyof typeof grid16 | keyof typeof grid24; tone?: string }) {
  const big = grid24[kind];
  if (big) {
    const [base, top] = big;
    const move = kind === "playground" ? "ai-tilt" : "ai-lift";
    return (
      <svg aria-hidden viewBox="0 0 24 24" className={`ai m-0.5 block size-4 overflow-visible ${tone}`} fill="none" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round">
        <g>{base.map((d) => <path key={d} d={d} />)}</g>
        <g className={move} style={{ "--ai-y": "-3px" } as CSSProperties}>{top.map((d) => <path key={d} d={d} />)}</g>
      </svg>
    );
  }
  const g = grid16[kind];
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`ai m-0.5 block size-4 overflow-visible ${g.motion ?? ""} ${tone}`} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      {g.parts}
    </svg>
  );
}

/** Section name with a quiet count (or a short word such as "Pro"). */
export function TabTitle({ label, count }: { label: string; count: number | string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      {label}
      <span className="text-[11.5px] font-normal text-subtle">{count}</span>
    </span>
  );
}
