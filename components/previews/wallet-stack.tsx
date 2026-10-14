"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, shade, signal } from "./palette";
import { follow, pressScale, t, tiers } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup } from "./piece-liquid";

/*
 * Wallet Stack: four passes stacked so each header strip shows, the last whole. A finger taps the Rail pass: it rises
 * to the top and opens to its QR code while the others slide down into a pile of narrowing slivers, and the clear
 * glass close bubble buds up out of its top corner. The finger drags the pass down past the threshold (the pile rises
 * to meet it) and lets go: it sinks back into the stack and the bubble melts into its corner. Then the red concert
 * ticket presents the same way, and a tap on the bubble puts it back. Rest again.
 *
 * The component is authored at a phone column's width, 352 px on the 560 px docs stage (1 pt = 1 px), and every
 * size is converted to `cqw`, so the stage scales as one picture. Passes are content, solid blocks with ink; the
 * close bubble is the only glass. Passes keep their stacking order the whole time, as the Swift piece does: the ones
 * in front of the presented pass slide off it, the ones behind slip under it, so nothing ever jumps in front.
 * Motion follows the piece: into the pile front first and back top first on the calm spring with follow-through,
 * the drag tracks the finger linearly, the bubble buds on the split spring and melts home on the bounceless one.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;

// Geometry, in px of the 560 x 420 stage.
const COL_W = 352;
const COL_X = (560 - COL_W) / 2;
/** The top of the component's frame. */
const TOP = 28;
const HEADER = 66;
const FIELDS = 58;
const CODE = 166;
const BUBBLE = 36;
/** The room above a presented pass for its close bubble. */
const ROW = BUBBLE + 10;
const SLIVER = 10;
/** How much of the pile's front pass shows above the stage's bottom edge. */
const FRONT = 16;
const PILE = 3;
const PILE_TOP = 420 - (PILE - 1) * SLIVER - FRONT;
/** A pull past this puts the pass back, as in the Swift piece. */
const THRESHOLD = 110;

type GlyphName = "columns" | "tram" | "note" | "ferry" | "xmark";

/** SF Symbols the piece draws, as SVG: `building.columns.fill`, `tram.fill`, `music.note`, `ferry.fill`, `xmark`. */
const glyphs: Record<GlyphName, { fill?: string; stroke?: string }> = {
  columns: { fill: "M12 2.4 2.8 7.3v1.9h18.4V7.3L12 2.4ZM4.8 10.6H7v6.6H4.8ZM8.9 10.6h2.2v6.6H8.9ZM12.9 10.6h2.2v6.6h-2.2ZM17 10.6h2.2v6.6H17ZM3 18.4h18v2.4H3Z" },
  tram: {
    fill: "M8 2.8h8A3.2 3.2 0 0 1 19.2 6v9.2a3.2 3.2 0 0 1-3.2 3.2H8a3.2 3.2 0 0 1-3.2-3.2V6A3.2 3.2 0 0 1 8 2.8ZM7.4 6.4v4.8h9.2V6.4ZM9.7 14.6a1.1 1.1 0 1 0-2.2 0 1.1 1.1 0 1 0 2.2 0ZM16.5 14.6a1.1 1.1 0 1 0-2.2 0 1.1 1.1 0 1 0 2.2 0Z",
    stroke: "M8.8 18.8 6.8 21.4M15.2 18.8l2 2.6",
  },
  note: { fill: "M13.2 16.6a3.4 3.4 0 1 1-6.8 0 3.4 3.4 0 1 1 6.8 0ZM11.6 3.2h1.8v13.4h-1.8ZM13.4 3.2c2.6.9 4.6 2.6 4.6 5.6-1.2-1.7-2.8-2.6-4.6-2.9Z" },
  ferry: {
    fill: "M2.8 12.4h18.4l-2.5 5H5.3ZM6.4 8.2h11.2v3.2H6.4ZM9.6 4.6h4.8v2.8H9.6Z",
    stroke: "M3 20.6c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1",
  },
  xmark: { stroke: "M6.5 6.5l11 11M17.5 6.5l-11 11" },
};

function Glyph({ name, size, stroke = 1.8 }: { name: GlyphName; size: number; stroke?: number }) {
  const g = glyphs[name];
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(size), height: u(size), flexShrink: 0, display: "block" }}>
      {g.fill ? <path d={g.fill} fill="currentColor" fillRule="evenodd" /> : null}
      {g.stroke ? <path d={g.stroke} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

type Pass = { id: string; title: string; subtitle: string; glyph: GlyphName; tint: string; key: [string, string]; fields: [string, string][]; code: string; qr: string };

/** The passes, back to front, with their codes as Core Image's QR generator draws them (21 rows, hex, quiet zone off). */
const PASSES: Pass[] = [
  {
    id: "gallery", title: "Gallery day pass", subtitle: "Casa da Luz, Lisbon", glyph: "columns", tint: blocks.butter, key: ["Entry", "11:00"],
    fields: [["Date", "Sat 25 Oct"], ["Guests", "2 adults"], ["Floors", "All"]], code: "GD-1180-0093",
    qr: "1fc07f 104c41 175e5d 17575d 17555d 105a41 1fd57f 001000 17c27c 1caf1a 0579e3 0e332e 067523 001529 1fce24 105c25 175a36 175be8 17554c 104bcd 1fdd24",
  },
  {
    id: "rail", title: "Rail pass", subtitle: "Lisbon to Porto", glyph: "tram", tint: blocks.sky, key: ["Coach", "4"],
    fields: [["Departs", "08:42"], ["Arrives", "11:37"], ["Seat", "14A"]], code: "SP-2291-0742",
    qr: "1fc57f 104241 17515d 175d5d 175d5d 105e41 1fd57f 001000 17c67c 0e3f8a 037162 1aa7dc 12f500 00192a 1fc622 105c25 17562e 1757d0 175174 1043f9 1fd924",
  },
  {
    id: "concert", title: "Night Market Live", subtitle: "Riverside Pavilion", glyph: "note", tint: signal.fill, key: ["Doors", "19:30"],
    fields: [["Date", "Fri 24 Oct"], ["Section", "Floor"], ["Gate", "C"]], code: "NML-0424-1187",
    qr: "1fdf7f 105e41 174a5d 17545d 174c5d 104441 1fd57f 001400 16ec4b 0b95ae 135905 0cb9c7 055248 001871 1fd851 105355 17466b 1754a2 17561c 104b58 1fd392",
  },
  {
    id: "ferry", title: "River ferry", subtitle: "Cais do Sodré to Cacilhas", glyph: "ferry", tint: blocks.sage, key: ["Boards", "17:10"],
    fields: [["Pier", "2"], ["Return", "Open"], ["Fare", "Adult"]], code: "RF-5530-0218",
    qr: "1fc17f 104b41 175c5d 175c5d 17595d 105241 1fd57f 001c00 17c27c 1493a9 064163 10377c 09e96b 00112c 1fc226 105825 175e3a 175be0 17554c 104bc5 1fd924",
  },
];

type Point = [x: number, y: number];

/**
 * One beat of the storyboard. `open` is the presented pass; `bubble` its close bubble out; `press` the pass or the
 * bubble under the finger; `drag` how far the presented pass is pulled down, tracked linearly over the step when
 * `track` is set; `finger` where the finger touches the stage, if it does. The finger is not drawn (the pass it holds
 * shows the touch); it places the finger in the launch video.
 */
type Step = { ms: number; open: string | null; bubble?: boolean; press?: string; drag?: number; track?: boolean; finger?: Point };

const RAIL_TAP: Point = [262, TOP + HEADER + HEADER / 2];
const CONCERT_TAP: Point = [262, TOP + HEADER * 2 + HEADER / 2];
const GRAB: Point = [300, TOP + ROW + 120];
const CLOSE: Point = [COL_X + COL_W - BUBBLE / 2, TOP + BUBBLE / 2];

/** A finger pulling the presented pass from 0 to `to` px over `ms`, cut into short linear steps. */
const pull = (open: string, to: number, ms: number): Step[] => {
  const n = 5;
  return Array.from({ length: n }, (_, i) => {
    const d = (to * (i + 1)) / n;
    return { ms: ms / n, open, bubble: true, drag: d, track: true, finger: [GRAB[0], GRAB[1] + d] };
  });
};

/** About 9.6 s: rest, the Rail pass presents, is dragged back, the concert ticket presents and is closed, rest. */
const STEPS: readonly Step[] = [
  { ms: 1500, open: null },
  { ms: 170, open: null, press: "rail", finger: RAIL_TAP },
  { ms: 200, open: "rail" },
  { ms: 1500, open: "rail", bubble: true },
  { ms: 260, open: "rail", bubble: true, finger: GRAB },
  ...pull("rail", 150, 600),
  { ms: 200, open: "rail", bubble: true, drag: 150, finger: [GRAB[0], GRAB[1] + 150] },
  { ms: 1500, open: null },
  { ms: 170, open: null, press: "concert", finger: CONCERT_TAP },
  { ms: 200, open: "concert" },
  { ms: 1800, open: "concert", bubble: true },
  { ms: 170, open: "concert", bubble: true, press: "close", finger: CLOSE },
  { ms: 1300, open: null },
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

/** Walks the storyboard; each step holds for `ms`, then loops. Holds the resting step under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const id = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(id);
  }, [i, steps, reduced]);
  return { step: steps[i], prev: steps[(i + steps.length - 1) % steps.length] };
}

/** A QR code from its hex rows, one run of dark modules per rect, crisp at any size. */
function Qr({ rows, size }: { rows: string; size: number }) {
  const lines = rows.split(" ");
  const n = lines.length;
  let d = "";
  lines.forEach((hex, y) => {
    const bits = parseInt(hex, 16);
    let x = 0;
    while (x < n) {
      if ((bits >> (n - 1 - x)) & 1) {
        let run = 1;
        while (x + run < n && (bits >> (n - 1 - x - run)) & 1) run++;
        d += `M${x} ${y}h${run}v1h-${run}z`;
        x += run;
      } else x++;
    }
  });
  return (
    <svg aria-hidden viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" style={{ width: u(size), height: u(size), display: "block" }}>
      <path d={d} fill={ink} />
    </svg>
  );
}

const label: CSSProperties = { fontSize: u(11), lineHeight: u(13), letterSpacing: "0.06em", textTransform: "uppercase" };

/** Secondary ink, quieter on the pass. On the red pass it stays full ink, as in Swift: even full ink on red is only
 *  about 4.6:1, so its labels never fade. */
const quiet = (pass: Pass, alpha: number) => (pass.tint === signal.fill ? ink : `rgba(20,20,20,${alpha})`);
const value: CSSProperties = { fontSize: u(17), lineHeight: u(21), fontVariantNumeric: "tabular-nums" };

/** A pass's face: the header strip, its fields, and the code area that opens while it is presented. */
function Face({ pass, open }: { pass: Pass; open: boolean }) {
  return (
    <div style={{ position: "relative", borderRadius: u(22), background: pass.tint, color: ink, overflow: "hidden", boxShadow: `0 ${u(2)} ${u(10)} ${shade(0.45)}` }}>
      <div className="flex items-center" style={{ height: u(HEADER), padding: `0 ${u(18)}`, gap: u(12) }}>
        <span className="flex items-center justify-center" style={{ width: u(36), height: u(36), borderRadius: u(12), background: ink, color: pass.tint, flexShrink: 0 }}>
          <Glyph name={pass.glyph} size={19} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col" style={{ gap: u(1) }}>
          <span className="truncate" style={{ fontSize: u(17), lineHeight: u(21) }}>{pass.title}</span>
          <span className="truncate" style={{ fontSize: u(13), lineHeight: u(17), color: quiet(pass, 0.7) }}>{pass.subtitle}</span>
        </span>
        <span className="flex flex-col items-end" style={{ gap: u(2), flexShrink: 0 }}>
          <span style={{ ...label, color: quiet(pass, 0.64) }}>{pass.key[0]}</span>
          <span style={value}>{pass.key[1]}</span>
        </span>
      </div>
      <div className="flex justify-between" style={{ height: u(FIELDS), padding: `${u(6)} ${u(18)} 0` }}>
        {pass.fields.map(([l, v]) => (
          <span key={l} className="flex flex-col" style={{ gap: u(2) }}>
            <span style={{ ...label, color: quiet(pass, 0.64) }}>{l}</span>
            <span style={value}>{v}</span>
          </span>
        ))}
      </div>
      {/* The code area opens with the pass on its calm spring; the code arrives just after and leaves first. */}
      <div data-motion style={{ height: u(open ? CODE : 0), overflow: "hidden", transition: t("height", open ? tiers.calm : follow(tiers.calm, 0)) }}>
        <div className="flex justify-center">
          <BudContent out={open}>
            <span className="flex flex-col items-center" style={{ background: "#ffffff", borderRadius: u(12), padding: u(12), gap: u(6) }}>
              <Qr rows={pass.qr} size={104} />
              <span style={{ fontFamily: font.mono, fontSize: u(13), lineHeight: u(16), color: ink, letterSpacing: "0.02em" }}>{pass.code}</span>
            </span>
          </BudContent>
        </div>
      </div>
    </div>
  );
}

/**
 * The clear glass close bubble, resting above the pass's top trailing corner. It sits under the face, so at home it is
 * hidden inside the pass's corner: it buds up out of the pass and slips back behind it to melt home.
 */
function CloseBubble({ out, pressed }: { out: boolean; pressed: boolean }) {
  return (
    <div className="absolute" style={{ right: 0, top: u(-ROW), width: u(BUBBLE), height: u(BUBBLE + 90), zIndex: 0 }}>
      <span data-motion className="block" style={{ width: u(BUBBLE), height: u(BUBBLE), transform: `scale(${pressed ? pressScale(BUBBLE, BUBBLE) : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
        <LiquidGroup unit={u(1)} axis="y" style={{ width: u(BUBBLE), height: u(BUBBLE + 90) }}>
          <Liquid bud={{ out, home: [0, ROW + BUBBLE / 2] }} className="flex items-center justify-center" style={{ width: u(BUBBLE), height: u(BUBBLE), color: ground.text }}>
            <BudContent out={out}><Glyph name="xmark" size={15} stroke={2.6} /></BudContent>
          </Liquid>
        </LiquidGroup>
      </span>
    </div>
  );
}

export function WalletStackPreview() {
  const { step: s, prev } = useSteps(STEPS);
  // The pass that last opened leads the way back, as in the Swift piece.
  const lastOpen = useRef<string | null>(null);
  if (s.open) lastOpen.current = s.open;
  const leader = s.open ?? lastOpen.current;
  const openIndex = s.open ? PASSES.findIndex((p) => p.id === s.open) : -1;
  const drag = s.drag ?? 0;
  const lift = Math.min(Math.max(drag, 0) / THRESHOLD, 1) * 14;
  // A drag that lands back in the stack leaves on the settle spring, from where the finger let go.
  const released = !s.open && (prev.drag ?? 0) > 0;

  const place = (i: number) => {
    if (openIndex < 0) return { y: TOP + i * HEADER, scale: 1, depth: 0 };
    if (i === openIndex) return { y: TOP + ROW + drag, scale: 1, depth: 0 };
    const depth = PASSES.filter((_, k) => k > i && k !== openIndex).length;
    const shown = Math.min(depth, PILE - 1);
    return { y: PILE_TOP + (PILE - 1 - shown) * SLIVER - lift, scale: 1 - 0.04 * (shown + 1), depth };
  };

  const motion = (pass: Pass, i: number, depth: number) => {
    if (s.track) return `transform ${Math.round(s.ms)}ms linear`;
    if (pass.id === leader) return t("transform", released ? "settle" : follow(tiers.calm, 0));
    // Into the pile front first; back into the stack top first.
    const order = s.open ? depth : PASSES.filter((p, k) => k < i && p.id !== leader).length;
    return t("transform", follow(tiers.calm, 1 + Math.min(order, 4)));
  };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
      {PASSES.map((pass, i) => {
        const { y, scale, depth } = place(i);
        const pressed = s.press === pass.id;
        return (
          <div key={pass.id} data-motion className="absolute" style={{
            left: u(COL_X), top: 0, width: u(COL_W), zIndex: (i + 1) * 10,
            transform: `translateY(${u(y)}) scale(${scale})`, transformOrigin: "top center", transition: motion(pass, i, depth),
          }}>
            {pass.id === "rail" || pass.id === "concert" ? <CloseBubble out={!!s.bubble && s.open === pass.id} pressed={s.press === "close" && s.open === pass.id} /> : null}
            {/* A pass in the stack dips under the finger like any card, and lets go with a little give. */}
            <div data-motion style={{ position: "relative", zIndex: 1, transform: `scale(${pressed ? pressScale(COL_W, HEADER + FIELDS, 2) : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
              <Face pass={pass} open={s.open === pass.id} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

