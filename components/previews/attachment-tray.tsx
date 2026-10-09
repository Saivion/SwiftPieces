"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, signal } from "./palette";
import { curve, pressScale, t, tiers, type Spring } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, budStyle } from "./piece-liquid";

/*
 * Attachment Tray: a liquid glass add tile with the count, then photo tiles. Two picks drop onto the end of the strip
 * as loading tiles, each carrying a glass status bubble with its ring, and a beat later the remove badge buds out of
 * that bubble to the corner on a liquid neck. The strip glides over to them. One fails: its bubble floods red with a
 * retry arrow. The other fills its ring, holds it full for a beat, and as the photo develops the bubble melts up into
 * the badge. The retry loads the same way, then both are removed and the rest close the gap.
 * Sizes are authored in px against the 560 px docs stage; one iOS point is one px there.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const SIDE = 76;
const GAP = 10;
const LIMIT = 5;
const PAPER = "#f4f3ef";
/** The status bubble, the ring inside it, and the remove badge, as AttachmentTray.swift sizes them. */
const BUBBLE = 30, RING = 18, BADGE = 22;
/** From a tile's centre to the remove badge's centre, along each axis: the badge sits 4pt in from the corner. */
const REACH = SIDE / 2 - 4 - BADGE / 2;
const REMOVE_AT: [number, number] = [REACH, -REACH];
/** A pick settles from at most 10 px past full size, as the Swift tray's drop at this tile size. */
const DROP = 1 + Math.min(0.1, 10 / SIDE);
/** Size-aware press depths: a 76 px tile, and the badge's 44 pt hit area. */
const TILE_PRESS = pressScale(SIDE, SIDE);
const BADGE_PRESS = pressScale(44, 44);
/** Progress is data: a smooth follow with no overshoot, as Swift's `.smooth(duration: 0.3)`. */
const FOLLOW: Spring = { duration: 0.3, bounce: 0 };

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
/** `p` is the ring's last reading; a failed tile keeps it so its ring blurs away as it stood. `born` holds a tile just
 *  dropped onto the strip with its remove badge still inside the status bubble. */
type Tile = { id: string; scene: number; phase: Phase; p?: number; out?: boolean; born?: boolean };
/** `lay` holds the strip at an earlier tile count; `glide` moves it on `reveal` instead of `snap`. */
type Step = { tiles: Tile[]; press?: string; lay?: number; glide?: boolean; ms: number };

const A: Tile = { id: "a", scene: 0, phase: "loaded" };
const B: Tile = { id: "b", scene: 1, phase: "loaded" };
const C: Tile = { id: "c", scene: 2, phase: "loaded" };
const rest = [A, B, C];
const D = (phase: Phase, p?: number, out?: boolean, born?: boolean): Tile => ({ id: "d", scene: 3, phase, p, out, born });
const E = (phase: Phase, p?: number, out?: boolean, born?: boolean): Tile => ({ id: "e", scene: 4, phase, p, out, born });

const steps: readonly Step[] = [
  { tiles: rest, ms: 1500 },
  { tiles: rest, press: "add", ms: 260 },
  // Picks into a tray that has tiles land together at the end of the strip as it stood, and both loads start
  // at once. The count and the disc lead; 180 ms into the drop each remove badge buds out of its status bubble,
  // and the strip glides to the newest tile once they have settled.
  { tiles: [...rest, D("spin", undefined, false, true), E("spin", undefined, false, true)], lay: rest.length, ms: 180 },
  { tiles: [...rest, D("spin"), E("spin")], lay: rest.length, ms: 350 },
  { tiles: [...rest, D("spin"), E("spin")], glide: true, ms: 330 },
  // E fails from its spinner right after the glide, while D is still filling.
  { tiles: [...rest, D("ring", 0.4), E("failed")], ms: 380 },
  { tiles: [...rest, D("ring", 0.8), E("failed")], ms: 340 },
  // A finished load closes its ring fast and holds it full for a beat (Swift's 150 ms); then the photo develops.
  { tiles: [...rest, D("ring", 1), E("failed")], ms: 240 },
  { tiles: [...rest, D("loaded"), E("failed")], ms: 900 },
  { tiles: [...rest, D("loaded"), E("failed")], press: "e", ms: 260 },
  { tiles: [...rest, D("loaded"), E("spin")], ms: 500 },
  { tiles: [...rest, D("loaded"), E("ring", 0.62)], ms: 420 },
  { tiles: [...rest, D("loaded"), E("ring", 1)], ms: 240 },
  { tiles: [...rest, D("loaded"), E("loaded")], ms: 1500 },
  { tiles: [...rest, D("loaded"), E("loaded")], press: "x-e", ms: 220 },
  { tiles: [...rest, D("loaded"), E("loaded", undefined, true)], ms: 460 },
  { tiles: [...rest, D("loaded")], press: "x-d", ms: 220 },
  { tiles: [...rest, D("loaded", undefined, true)], ms: 460 },
];

/** Centre of slot `i` (the add tile is slot 0) in a row of `n` photo tiles, centred on the stage. */
const slotX = (i: number, n: number) => -(SIDE + n * (SIDE + GAP)) / 2 + SIDE / 2 + i * (SIDE + GAP);

/**
 * A place on the strip. Closing a gap is quick, on `snap`. Gliding over to new picks is Swift's `reveal(_:)`
 * scroll, a calm move that starts once they have landed.
 */
const slot = (x: number, glide = false): CSSProperties => ({
  position: "absolute", left: "50%", top: u(6), width: u(SIDE), height: u(SIDE), marginInlineStart: u(-SIDE / 2),
  transform: `translateX(${u(x)})`, transition: t("transform", glide ? "reveal" : "snap"),
});

/** Swift's press: in on `press` with no bounce, back out on `release` with give. */
const pressed = (on: boolean, scale: number): CSSProperties => ({
  transform: on ? `scale(${scale})` : "none", transition: t("transform", on ? "press" : "release"),
});

/** A face swapped inside a tile that stays put: the old one blurs out as the new one sharpens in. */
const swap = (shown: boolean): CSSProperties =>
  shown ? { opacity: 1, filter: `blur(${u(0)})`, transform: "none" } : { opacity: 0, filter: `blur(${u(4)})`, transform: "scale(0.9)" };

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
          strokeDasharray={`${(spinning ? 0.28 : Math.max(p, 0.02)) * c} ${c}`}
          // The last stretch closes fast, so the ring is full before the photo covers it.
          style={{ transition: spinning ? undefined : t("stroke-dasharray", p >= 1 ? tiers.tight : FOLLOW) }}
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

/** A count is read, so it rolls on `value` and never shows past its number: up as it grows, down as it shrinks. */
function Roll({ value }: { value: number }) {
  const [roll, setRoll] = useState({ now: value, was: value, dir: 0, n: 0 });
  if (roll.now !== value) setRoll({ now: value, was: roll.now, dir: value > roll.now ? 1 : -1, n: roll.n + 1 });
  const { easing, ms } = curve("value");
  const dir = { "--at-dir": roll.dir } as CSSProperties;
  return (
    <span style={{ display: "inline-grid" }}>
      {/* The outgoing digit stays mounted at zero opacity, so it is hidden from assistive tech. */}
      {roll.n > 0 && (
        <span key={roll.n - 1} aria-hidden data-motion style={{ ...dir, gridArea: "1 / 1", animation: `at-roll-out ${ms}ms ${easing} both` }}>{roll.was}</span>
      )}
      <span key={roll.n} data-motion style={{ ...dir, gridArea: "1 / 1", animation: roll.n > 0 ? `at-roll-in ${ms}ms ${easing} both` : undefined }}>{roll.now}</span>
    </span>
  );
}

/**
 * A photo tile: the thumbnail is content, the glass floats over it. While the tile loads, fails or retries, the status
 * bubble sits at its centre, joined to the remove badge by a liquid neck; once the photo has developed the bubble
 * melts into the badge. The tile and its glass press, drop and leave together.
 */
function PhotoTile({ tile, x, glide, press }: { tile: Tile; x: number; glide: boolean; press?: string }) {
  const out = tile.out === true;
  const face = tile.phase === "loaded" ? "photo" : tile.phase === "failed" ? "retry" : "ring";
  const drop = curve("settle");
  // A loaded tile's ring stays closed while the bubble melts home; a failed one keeps the reading it failed at (a
  // spinner if none).
  const ringP = tile.phase === "loaded" ? 1 : tile.phase === "spin" ? undefined : tile.p;
  const status = tile.phase !== "loaded";
  const badge = tile.born !== true;
  const failed = tile.phase === "failed";
  return (
    <div data-motion style={slot(x, glide)}>
      {/* Dropped onto the strip: settles from just above full size with some give. Removal is quick and firm. */}
      <div
        data-motion
        style={{
          position: "absolute", inset: 0, opacity: out ? 0 : 1, transform: out ? "scale(0.5)" : "none",
          transition: t(["transform", "opacity"], "dismiss"), animation: `at-drop ${drop.ms}ms ${drop.easing} backwards`,
        }}
      >
        <div data-motion style={{ position: "absolute", inset: 0, ...pressed(press === tile.id, TILE_PRESS) }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: u(18), overflow: "hidden", background: ground.field }}>
            {/* The Retry label hangs under the bubble, swapped on the tile as the bubble floods red. */}
            <span
              data-motion
              aria-hidden={!failed || undefined}
              style={{ position: "absolute", left: 0, right: 0, top: `calc(50% + ${u(BUBBLE / 2 + 5)})`, textAlign: "center", fontSize: u(12), fontWeight: 600, color: ground.text, ...swap(failed), transition: t(["opacity", "filter", "transform"], failed ? "error" : "snap") }}
            >
              Retry
            </span>
            {/* The photo develops from a slight zoom, on `value` so it never dips to show the tile edge. */}
            <div
              data-motion
              aria-hidden={face !== "photo" || undefined}
              style={{ position: "absolute", inset: 0, opacity: face === "photo" ? 1 : 0, transform: face === "photo" ? "none" : "scale(1.14)", transition: t(["opacity", "transform"], "value") }}
            >
              <Scene scene={tile.scene} />
            </div>
          </div>
          {/* The glass, laid out from the tile's centre. No lift: over a photo it needs no shadow. */}
          <LiquidGroup unit={u(1)} axis="both" lift={false} style={{ position: "absolute", inset: 0 }}>
            <div style={{ position: "relative", width: u(SIDE), height: u(SIDE) }}>
              {/* The bud moves a wrapper, so the glass can flood red and drain on its own beat as the Swift tint does. */}
              <div data-motion style={{ position: "absolute", left: "50%", top: "50%", width: u(BUBBLE), height: u(BUBBLE), margin: `${u(-BUBBLE / 2)} 0 0 ${u(-BUBBLE / 2)}`, ...budStyle({ out: status, home: REMOVE_AT }, u(1)) }}>
                <Liquid
                  tint={status && failed ? signal.fill : undefined}
                  className="grid place-items-center"
                  style={{ width: u(BUBBLE), height: u(BUBBLE), transition: t("background-color", failed ? "error" : "snap") }}
                >
                  <BudContent out={status}>
                    <span style={{ display: "grid", placeItems: "center", width: u(RING), height: u(RING) }}>
                      {/* The ring and the retry arrow swap inside the bubble: one blurs out as the other sharpens in. */}
                      <span data-motion style={{ gridArea: "1 / 1", display: "grid", placeItems: "center", ...swap(face !== "retry"), transition: t(["opacity", "filter", "transform"], face === "retry" ? "error" : "snap") }}>
                        <Ring p={ringP} color={ground.text} />
                      </span>
                      <span data-motion style={{ gridArea: "1 / 1", display: "grid", placeItems: "center", color: signal.on, ...swap(face === "retry"), transition: t(["opacity", "filter", "transform"], face === "retry" ? "error" : "snap") }}>
                        <Glyph d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" size={13} width={3} />
                      </span>
                    </span>
                  </BudContent>
                </Liquid>
              </div>
              {/* Last, so the bubble melting home slips under the badge. Placed in its corner, where it sinks about its
                  own centre when pressed; it buds from, and would melt back into, the bubble at the tile's centre. */}
              <div
                data-motion
                style={{
                  position: "absolute", left: "50%", top: "50%", width: u(BADGE), height: u(BADGE), margin: `${u(-BADGE / 2)} 0 0 ${u(-BADGE / 2)}`,
                  transform: `translate(${u(REACH)}, ${u(-REACH)})${press === `x-${tile.id}` ? ` scale(${BADGE_PRESS})` : ""}`,
                  transition: t("transform", press === `x-${tile.id}` ? "press" : "release"),
                }}
              >
                <Liquid bud={{ out: badge, home: [-REACH, REACH] }} className="grid place-items-center" style={{ width: u(BADGE), height: u(BADGE), color: ground.text }}>
                  <BudContent out={badge}>
                    <Glyph d="M7 7l10 10M17 7L7 17" size={10} width={3.2} />
                  </BudContent>
                </Liquid>
              </div>
            </div>
          </LiquidGroup>
        </div>
      </div>
    </div>
  );
}

export function AttachmentTrayPreview() {
  const s = useSteps(steps);
  const present = s.tiles.filter((t) => !t.out);
  const count = present.length;
  const full = count >= LIMIT;
  const blur = u(2);
  // New picks land in the strip as it stood (the last one only a sliver at the stage edge) until it glides over.
  const lay = s.lay ?? count;
  const glide = s.glide === true;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes at-drop{from{opacity:0;transform:scale(${DROP.toFixed(3)})}}@keyframes at-roll-in{from{opacity:0;filter:blur(${blur});transform:translateY(calc(var(--at-dir) * 60%)) scale(.8)}}@keyframes at-roll-out{to{opacity:0;filter:blur(${blur});transform:translateY(calc(var(--at-dir) * -60%)) scale(.8)}}@keyframes at-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){[data-motion]{animation:none!important;transition:none!important}}`}</style>
      <div style={{ position: "relative", flex: "none", width: u(SIDE * 6 + GAP * 5), height: u(SIDE + 12) }}>
        <div data-motion style={slot(slotX(0, lay), glide)}>
          {/* The add tile is a glass tile; its plus disc is the one solid red mark on the strip. */}
          <div data-motion style={{ position: "absolute", inset: 0, ...pressed(s.press === "add", TILE_PRESS) }}>
            <LiquidGroup unit={u(1)} axis="both" lift={false}>
              <Liquid radius={18} className="flex flex-col items-center justify-center" style={{ width: u(SIDE), height: u(SIDE), gap: u(5) }}>
                <span className="grid place-items-center rounded-full" style={{ width: u(SIDE * 0.4), height: u(SIDE * 0.4), background: signal.fill, color: signal.on, opacity: full ? 0.25 : 1, transition: t("opacity", "snap") }}>
                  <Glyph d="M12 6v12M6 12h12" size={SIDE * 0.2} width={3} />
                </span>
                <span style={{ fontSize: u(12), fontWeight: 600, fontVariantNumeric: "tabular-nums", color: full ? ground.text : ground.muted, transition: t("color", "snap") }}>
                  <Roll value={count} />/{LIMIT}
                </span>
              </Liquid>
            </LiquidGroup>
          </div>
        </div>
        {s.tiles.map((tile, i) => {
          // A leaving tile shrinks on the strip and moves with it as the strip closes up, so nothing slides under it.
          const x = slotX((tile.out ? i : present.indexOf(tile)) + 1, lay);
          return <PhotoTile key={tile.id} tile={tile} press={s.press} x={x} glide={glide} />;
        })}
      </div>
    </div>
  );
}
