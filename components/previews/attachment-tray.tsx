"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink, signal } from "./palette";

/*
 * Attachment Tray: an add tile with the count, then photo tiles. Two picks land as loading tiles, one
 * fills its ring and settles into a thumbnail, the other fails and retries, the tray hits its limit,
 * then both are removed with their badges. Sizes are authored in px against the 560 px docs stage.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const SIDE = 76;
const GAP = 10;
const LIMIT = 5;
const PAPER = "#f4f3ef";

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

/** The same flat scenes the Swift example draws: sky, sun, land. */
const SCENES: Array<[string, string, string]> = [
  [blocks.sky, blocks.butter, blocks.sage],
  [blocks.sand, blocks.tangerine, blocks.lilac],
  [blocks.sage, PAPER, blocks.sky],
  [blocks.lilac, blocks.butter, blocks.sky],
  [blocks.butter, PAPER, blocks.sand],
];

type Phase = "spin" | "ring" | "loaded" | "failed";
type Tile = { id: string; scene: number; phase: Phase; p?: number; out?: boolean };
type Step = { tiles: Tile[]; press?: string; ms: number };

const A: Tile = { id: "a", scene: 0, phase: "loaded" };
const B: Tile = { id: "b", scene: 1, phase: "loaded" };
const C: Tile = { id: "c", scene: 2, phase: "loaded" };
const rest = [A, B, C];
const D = (phase: Phase, p?: number, out?: boolean): Tile => ({ id: "d", scene: 3, phase, p, out });
const E = (phase: Phase, p?: number, out?: boolean): Tile => ({ id: "e", scene: 4, phase, p, out });

const steps: readonly Step[] = [
  { tiles: rest, ms: 1500 },
  { tiles: rest, press: "add", ms: 260 },
  { tiles: [...rest, D("spin"), E("spin")], ms: 800 },
  { tiles: [...rest, D("ring", 0.45), E("ring", 0.15)], ms: 480 },
  { tiles: [...rest, D("ring", 0.92), E("ring", 0.4)], ms: 460 },
  { tiles: [...rest, D("loaded"), E("ring", 0.55)], ms: 700 },
  { tiles: [...rest, D("loaded"), E("failed")], ms: 1300 },
  { tiles: [...rest, D("loaded"), E("failed")], press: "e", ms: 260 },
  { tiles: [...rest, D("loaded"), E("spin")], ms: 500 },
  { tiles: [...rest, D("loaded"), E("ring", 0.62)], ms: 420 },
  { tiles: [...rest, D("loaded"), E("loaded")], ms: 1500 },
  { tiles: [...rest, D("loaded"), E("loaded")], press: "x-e", ms: 220 },
  { tiles: [...rest, D("loaded"), E("loaded", undefined, true)], ms: 460 },
  { tiles: [...rest, D("loaded")], press: "x-d", ms: 220 },
  { tiles: [...rest, D("loaded", undefined, true)], ms: 460 },
];

function Scene({ scene }: { scene: number }) {
  const [sky, sun, land] = SCENES[scene % SCENES.length];
  return (
    <svg aria-hidden viewBox="150 0 900 900" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <rect x="0" y="0" width="1200" height="900" fill={sky} />
      <circle cx="610" cy="290" r="130" fill={sun} />
      <path d="M0 640 Q520 420 1200 560 L1200 900 L0 900 Z" fill={land} />
    </svg>
  );
}

function Ring({ p, color }: { p?: number; color: string }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const spinning = p === undefined;
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: u(SIDE * 0.3), height: u(SIDE * 0.3), overflow: "visible" }}>
      <circle cx="12" cy="12" r={r} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={2.6} />
      <g data-motion style={{ transformOrigin: "12px 12px", animation: spinning ? "at-spin .9s linear infinite" : undefined, transform: spinning ? undefined : "rotate(-90deg)" }}>
        <circle
          cx="12" cy="12" r={r} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round"
          strokeDasharray={`${(spinning ? 0.28 : Math.max(p ?? 0, 0.02)) * c} ${c}`}
          style={{ transition: `stroke-dasharray .3s ${ease}` }}
        />
      </g>
    </svg>
  );
}

function Glyph({ d, size, width = 3.4 }: { d: string; size: number; width?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size) }}>
      <path d={d} />
    </svg>
  );
}

function PhotoTile({ tile, press }: { tile: Tile; press?: string }) {
  const out = tile.out === true;
  const style: CSSProperties = {
    position: "relative", flex: "none", width: out ? 0 : u(SIDE), height: u(SIDE), marginInlineStart: out ? 0 : u(GAP),
    opacity: out ? 0 : 1, transform: `scale(${out ? 0.5 : press === tile.id ? 0.94 : 1})`,
    transition: `width .42s ${ease}, margin .42s ${ease}, opacity .25s, transform .3s ${spring}`,
    animation: `at-in .45s ${spring} backwards`,
  };
  return (
    <div data-motion style={style}>
      <div style={{ position: "absolute", inset: 0, borderRadius: u(18), overflow: "hidden", background: ground.field, display: "grid", placeItems: "center" }}>
        {tile.phase === "loaded" ? (
          <div data-motion style={{ position: "absolute", inset: 0, animation: `at-thumb .45s ${spring} both` }}><Scene scene={tile.scene} /></div>
        ) : tile.phase === "failed" ? (
          <div className="flex flex-col items-center" style={{ gap: u(5), animation: "at-fade .2s both" }}>
            <span className="grid place-items-center rounded-full" style={{ width: u(SIDE * 0.3), height: u(SIDE * 0.3), background: signal.fill, color: signal.on }}>
              <Glyph d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" size={SIDE * 0.14} width={3.2} />
            </span>
            <span style={{ fontSize: u(12), fontWeight: 600, color: ground.text }}>Retry</span>
          </div>
        ) : (
          <Ring p={tile.phase === "ring" ? tile.p : undefined} color={ground.text} />
        )}
      </div>
      <span
        data-motion
        className="grid place-items-center rounded-full"
        style={{
          position: "absolute", top: u(4), insetInlineEnd: u(4), width: u(22), height: u(22), background: ink, color: PAPER,
          transform: press === `x-${tile.id}` ? "scale(0.82)" : "none", transition: `transform .25s ${spring}`,
        }}
      >
        <Glyph d="M7 7l10 10M17 7L7 17" size={9} width={3.8} />
      </span>
    </div>
  );
}

export function AttachmentTrayPreview() {
  const s = useSteps(steps);
  const count = s.tiles.filter((t) => !t.out).length;
  const full = count >= LIMIT;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes at-in{from{width:0;margin-inline-start:0;opacity:0;transform:scale(.6)}}@keyframes at-thumb{from{opacity:0;transform:scale(1.14)}to{opacity:1;transform:none}}@keyframes at-fade{from{opacity:0}to{opacity:1}}@keyframes at-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}`}</style>
      <div className="flex items-center justify-center" style={{ width: u(SIDE * 6 + GAP * 5), height: u(SIDE + 12) }}>
        <div
          data-motion
          className="flex flex-col items-center justify-center"
          style={{
            flex: "none", width: u(SIDE), height: u(SIDE), gap: u(5), borderRadius: u(18), background: ground.field,
            transform: s.press === "add" ? "scale(0.94)" : "none", transition: `transform .3s ${spring}`,
          }}
        >
          <span className="grid place-items-center rounded-full" style={{ width: u(SIDE * 0.4), height: u(SIDE * 0.4), background: signal.fill, color: signal.on, opacity: full ? 0.25 : 1, transition: "opacity .25s" }}>
            <Glyph d="M12 6v12M6 12h12" size={SIDE * 0.2} width={3.4} />
          </span>
          <span style={{ fontSize: u(12), fontWeight: 600, fontVariantNumeric: "tabular-nums", color: full ? ground.text : ground.muted, transition: "color .25s" }}>{count}/{LIMIT}</span>
        </div>
        {s.tiles.map((t) => <PhotoTile key={t.id} tile={t} press={s.press} />)}
      </div>
    </div>
  );
}
