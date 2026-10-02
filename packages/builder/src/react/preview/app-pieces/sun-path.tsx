"use client";
// Sun Path (definitions/app-pieces/sun-path.ts): the same scenes, dial and chrome as the SwiftUI.
// Drag sideways anywhere to move through the day in five-minute steps (a tick every quarter hour):
// the sun rides its arc, the shadow swings and stretches, the time and readouts follow. Now
// springs back to the present; the place bar and the toolbar follow their links. The sweep
// palette sets the time large at the top and the place on a card, and follows the colour scheme
// (pale ground and dark ink in light); daylight keeps pill chrome. Scene and chrome settle in once
// from 0.95; buttons press to 0.97.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Aperture, Calendar, ChevronUp, Compass, Ellipsis, Layers, LocateFixed, Map as MapIcon, Scan, Search, Sun } from "lucide-react";
import { CITY_AVENUE, SUN_CITY, SUN_FIELD, SUN_HILLS, SUN_PINE, SUN_SCENES, SKY_GLINTS, SKY_PATH, SUN_SHADE, SUN_SKY, SUN_SWEEP as SUN_SWEEP_HEX, SUN_TERRAIN, SUN_TONES, SUN_WORLD, clockLabel, compass, contour, parseClock, sunAt } from "../../../definitions/app-pieces/sun-path.js";
import { b, n, s, useScheme, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { SPRING, useDrag, useLive, useRuntime, useTap } from "../runtime.js";
import { useEdgeBleed } from "./edge-bleed.js";

/** Its table with the house red as the app accent (Style), like every other piece. */
const SUN_SWEEP = accentize(SUN_SWEEP_HEX);

const rgb = (r: number, g: number, bl: number, a = 1) => `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(bl * 255)}, ${a})`;

type Tone = keyof typeof SUN_TONES;

/** Mix two hex colours, f from a (0) to b (1). */
function mix(a: string, b: string, f: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * f)).join(", ")})`;
}

/** The outline of a box and its copy moved by (vx, vy): the shadow a block casts on the ground. */
function castHull(x: number, y: number, bw: number, bh: number, vx: number, vy: number): string {
  const pts: Array<[number, number]> = [[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh], [x + vx, y + vy], [x + bw + vx, y + vy], [x + bw + vx, y + bh + vy], [x + vx, y + bh + vy]];
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Array<[number, number]>) => {
    const out: Array<[number, number]> = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  return `M${hull.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("L")}Z`;
}

const ring = (pts: Array<[number, number]>, dx = 0, dy = 0) => `M${pts.map((q) => `${(q[0] + dx).toFixed(1)},${(q[1] + dy).toFixed(1)}`).join("L")}Z`;

/** The world (400 × 600) fitted to the scene, turned for the city. */
const worldTransform = (w: number, h: number, turn: number, zoom: number) => `translate(${w / 2} ${h / 2}) rotate(${turn}) scale(${Math.max(w / SUN_WORLD.w, h / SUN_WORLD.h) * zoom}) translate(${-SUN_WORLD.w / 2} ${-SUN_WORLD.h / 2})`;

/**
 * The scene behind the dial. The maps take the sun's shadow direction (sx, sy, on screen) and its
 * shadow ratio, so every roof, tree and slope casts its shadow with the dial's.
 */
function Scene({ scene, w, h, id, sweep, lit, sx, sy, ratio }: { scene: string; w: number; h: number; id: string; sweep: boolean; lit: boolean; sx: number; sy: number; ratio: number }) {
  const idx = sweep ? (lit ? 2 : 0) : 1;
  const T = (k: Tone) => SUN_TONES[k][idx];
  const shade = SUN_SHADE[idx];
  const ink = sweep ? (lit ? "#1C1C1E" : "#FFFFFF") : "#2A2A2A";
  const long = Math.min(ratio, 5);
  if (scene === "city") {
    // Screen direction into the turned world.
    const a = (-SUN_WORLD.cityTurn * Math.PI) / 180;
    const wx = sx * Math.cos(a) - sy * Math.sin(a);
    const wy = sx * Math.sin(a) + sy * Math.cos(a);
    const L = 15 * long;
    const { blocks, buildings, park, trees, river } = SUN_CITY;
    const { from, to, width } = CITY_AVENUE;
    return (
      <g transform={worldTransform(w, h, SUN_WORLD.cityTurn, SUN_WORLD.cityZoom)}>
        <rect x={-400} y={-400} width={1200} height={1400} fill={T("street")} />
        {blocks.map(([x, y, bw, bh], i) => <rect key={i} x={x} y={y} width={bw} height={bh} rx={3} fill={T("block")} />)}
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={T("avenue")} strokeWidth={width} />
        <path d={`M${river.map((q) => q.join(",")).join("L")}L560,900L-200,900Z`} fill={T("water")} />
        <path d={`M${river.map((q) => `${q[0]},${q[1] - 9}`).join("L")}`} fill="none" stroke={T("avenue")} strokeWidth={8} />
        <rect x={park[0]} y={park[1]} width={park[2]} height={park[3]} rx={10} fill={T("park")} />
        <line x1={park[0] + 6} y1={park[1] + 6} x2={park[0] + park[2] - 6} y2={park[1] + park[3] - 6} stroke={T("block")} strokeWidth={3} strokeLinecap="round" />
        <g opacity={shade}>
          {buildings.map(([x, y, bw, bh, z], i) => <path key={i} d={castHull(x, y, bw, bh, wx * L * z, wy * L * z)} fill="#000" />)}
          {trees.map(([x, y, r], i) => <circle key={i} cx={x + wx * r * long * 0.5} cy={y + wy * r * long * 0.5} r={r} fill="#000" />)}
        </g>
        {trees.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={T("tree")} />)}
        {buildings.map(([x, y, bw, bh], i) => <rect key={i} x={x} y={y} width={bw} height={bh} rx={1.5} fill={T("roof")} stroke={T("roofEdge")} strokeWidth={0.6} />)}
      </g>
    );
  }
  if (scene === "terrain") {
    const vx = sx * (2 + long * 1.6);
    const vy = sy * (2 + long * 1.6);
    const { road, trail, woods, houses, shore, stream } = SUN_TERRAIN;
    const [px, py] = SUN_HILLS[0];
    return (
      <g transform={worldTransform(w, h, 0, SUN_WORLD.hillZoom)}>
        <rect x={-400} y={-400} width={1200} height={1400} fill={T("low")} />
        {SUN_HILLS.map((hill, hi) => {
          const n = hill[2];
          const out = contour(hill, n);
          return (
            <g key={hi}>
              {/* The hill's own shadow on the valley, away from the sun. */}
              <path d={ring(out, vx * 3, vy * 3)} fill="#000" opacity={shade * 0.8} filter={`url(#${id}-blur)`} />
              <path d={ring(out)} fill={T("low")} />
              {Array.from({ length: n - 1 }, (_, j) => {
                const k = n - 1 - j;
                const pts = contour(hill, k);
                // Each step shades the one below it on its lee side, then takes its tint.
                return (
                  <g key={k}>
                    <path d={ring(pts, vx, vy)} fill="#000" opacity={shade * 0.35} filter={`url(#${id}-soft)`} />
                    <path d={ring(pts)} fill={mix(T("low"), T("high"), (n - k) / (n - 1))} />
                  </g>
                );
              })}
              {Array.from({ length: n }, (_, j) => (
                <path key={j} d={ring(contour(hill, j + 1))} fill="none" stroke={T("contour")} strokeOpacity={(j + 1) % 4 === 0 ? 0.55 : 0.28} strokeWidth={(j + 1) % 4 === 0 ? 1.1 : 0.6} />
              ))}
            </g>
          );
        })}
        <path d={`M${shore[0]},${shore[1]}Q${shore[2]},${shore[3]} ${shore[4]},${shore[5]}Q${shore[6]},${shore[7]} ${shore[8]},${shore[9]}L250,900L-200,900L-200,${shore[1]}Z`} fill={T("water")} />
        <path d={`M${stream[0]},${stream[1]}C${stream.slice(2).join(" ")}`} fill="none" stroke={T("water")} strokeWidth={2.4} strokeLinecap="round" />
        <g opacity={shade}>
          {woods.map(([x, y, r], i) => <circle key={i} cx={x + vx * 0.8} cy={y + vy * 0.8} r={r} fill="#000" />)}
          {houses.map(([x, y, bw, bh, z], i) => <path key={i} d={castHull(x, y, bw, bh, vx * 1.6 * z, vy * 1.6 * z)} fill="#000" />)}
        </g>
        {woods.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={T("wood")} />)}
        <path d={`M${trail[0]},${trail[1]}C${trail.slice(2).join(" ")}`} fill="none" stroke={T("contour")} strokeOpacity={0.8} strokeWidth={1.4} strokeDasharray="3 4" strokeLinecap="round" />
        <path d={`M${road[0]},${road[1]}C${road.slice(2, 8).join(" ")}C${road.slice(8).join(" ")}`} fill="none" stroke={T("casing")} strokeWidth={10} strokeLinecap="round" />
        <path d={`M${road[0]},${road[1]}C${road.slice(2, 8).join(" ")}C${road.slice(8).join(" ")}`} fill="none" stroke={T("road")} strokeWidth={6.5} strokeLinecap="round" />
        {houses.map(([x, y, bw, bh], i) => <rect key={i} x={x} y={y} width={bw} height={bh} rx={1.5} fill={T("roof")} stroke={T("roofEdge")} strokeWidth={0.6} />)}
        {/* The summit, marked and named by its height. */}
        <path d={`M${px},${py - 5}L${px + 5},${py + 4}L${px - 5},${py + 4}Z`} fill={ink} fillOpacity={0.75} />
        <text x={px + 9} y={py + 4} fontSize={10} fontWeight={600} fill={ink} fillOpacity={0.6} style={{ fontVariantNumeric: "tabular-nums" }}>528 m</text>
      </g>
    );
  }
  if (scene === "sky") {
    // The shore's rise, where the pines stand.
    const shoreAt = (u: number) => {
      const m = 1 - u;
      return { x: 2 * m * u * 0.3 * w + u * u * 0.62 * w, y: m * m * 0.4 * h + 2 * m * u * 0.52 * h + u * u * 0.67 * h };
    };
    return (
      <g>
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            {(sweep ? (lit ? SUN_SKY.light : SUN_SKY.dark) : SUN_SKY.day).map((c, i, a) => <stop key={i} offset={i / (a.length - 1)} stopColor={c} />)}
          </linearGradient>
          <linearGradient id={`${id}-lake`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={T("lakeTop")} /><stop offset="1" stopColor={T("lakeBottom")} /></linearGradient>
        </defs>
        <rect width={w} height={h * 0.66} fill={`url(#${id}-sky)`} />
        <rect y={h * 0.66} width={w} height={h * 0.34} fill={`url(#${id}-lake)`} />
        <g transform={`translate(${w} 0) scale(-1 1)`}>
        <path d={`M${w * 0.26},${h * 0.66} Q${w * 0.62},${h * 0.53} ${w},${h * 0.585} L${w},${h * 0.66} Z`} fill={T("farHills")} />
        <path d={`M${w * 0.5},${h * 0.66} Q${w * 0.8},${h * 0.605} ${w},${h * 0.63} L${w},${h * 0.66} Z`} fill={T("nearHills")} />
        <path d={`M0,${h * 0.4} Q${w * 0.3},${h * 0.52} ${w * 0.62},${h * 0.67} L0,${h * 0.67} Z`} fill={T("shore")} />
        {Array.from({ length: 7 }, (_, k) => {
          const b0 = shoreAt(0.06 + k * 0.12);
          const x = b0.x + w * 0.02;
          const base = b0.y + h * 0.03;
          const ht = (0.21 - k * 0.018) * h;
          const tw = ht * 0.36;
          const pts = [...SUN_PINE, ...SUN_PINE.slice(1).reverse().map(([u, v]) => [-u, v])];
          return <path key={k} d={`M${pts.map(([u, v]) => `${(x + u * tw).toFixed(1)},${(base - v * ht).toFixed(1)}`).join("L")}Z`} fill={T("trees")} />;
        })}
        </g>
      </g>
    );
  }
  if (sweep) {
    return (
      <g>
        <defs>
          <linearGradient id={`${id}-night`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={(lit ? SUN_FIELD.light : SUN_FIELD.dark)[0]} /><stop offset="1" stopColor={(lit ? SUN_FIELD.light : SUN_FIELD.dark)[1]} /></linearGradient>
        </defs>
        <rect width={w} height={h} fill={`url(#${id}-night)`} />
      </g>
    );
  }
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-warm`} x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor={rgb(1, 0.84, 0.12)} /><stop offset="1" stopColor={rgb(0.97, 0.63, 0.11)} /></linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}-warm)`} />
    </g>
  );
}

const pillStyle = (fill: string, ink = "#fff"): CSSProperties => ({ padding: "6px 12px", borderRadius: cr(999), background: fill, color: ink, fontSize: ts(15), lineHeight: "20px", fontWeight: fw(600), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" });

export const SunPath: Renderer = ({ p, box }) => {
  const rt = useRuntime();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 393, h: 760 });
  const scene = SUN_SCENES[s(p, "scene")] ? s(p, "scene") : "plain";
  const sweep = s(p, "palette") !== "daylight";
  const scheme = useScheme();
  const lit = sweep && scheme === "light";
  const card = s(p, "frame") === "card";
  const corner = p.radius == null ? 28 : Number(p.radius);
  const [pressed, setPressed] = useState<string | null>(null);
  const press = (key: string) => ({
    onPointerDown: (e: { stopPropagation(): void }) => {
      e.stopPropagation();
      setPressed(key);
    },
    onPointerUp: () => setPressed(null),
    onPointerLeave: () => setPressed(null),
    onPointerCancel: () => setPressed(null),
  });
  const pressStyle = (key: string): CSSProperties => ({ transform: pressed === key ? "scale(.97)" : undefined, transition: "transform .12s ease-out, background-color .25s" });
  const bleed = useEdgeBleed(ref, !card, sweep ? (lit ? SUN_FIELD.light[0] : SUN_SCENES[scene].sweepTop) : SUN_SCENES[scene].top);
  const rise = parseClock(p.sunrise, 433);
  const set = parseClock(p.sunset, 1179);
  const now = Math.min(set, Math.max(rise, parseClock(p.now, 1000)));
  const [minutes, setMinutes] = useLive(now);
  const [dragging, setDragging] = useState(false);
  const from = useRef(now);
  const openPlace = useTap(p.link, "light");
  const openTool = useTap(p.toolLink, "light");

  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.closest<HTMLElement>(".spb-screen-fixed, .spb-screen-scroll");
    if (!el || !host) return;
    // A card measures itself (it sits inside the margins); edge to edge takes the screen's width.
    const measure = () => setSize({ w: (card ? el.clientWidth : host.clientWidth) || 393, h: host.clientHeight || 760 });
    // A set height takes precedence over filling the screen (see below).
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    if (card) ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [card]);

  const onDrag = useDrag({
    axis: "x",
    onStart: () => {
      from.current = minutes;
      setDragging(true);
    },
    onMove: (i) => {
      const next = Math.min(set, Math.max(rise, Math.round((from.current + (i.dx / size.w) * (set - rise)) / 5) * 5));
      if (Math.floor(next / 15) !== Math.floor(minutes / 15)) rt.haptic("selection", i.el);
      setMinutes(next);
    },
    onEnd: () => setDragging(false),
  });

  const { w } = size;
  const h = n(p, "height") > 0 ? n(p, "height") : card ? 520 : size.h;
  const still = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const t = Math.min(1, Math.max(0, (minutes - rise) / Math.max(1, set - rise)));
  const sun = sunAt(t);
  const c = { x: w / 2, y: h * (sweep ? (card ? 0.56 : 0.5) : 0.52) };
  const r = w * (sweep && card ? 0.35 : 0.32);
  const sunPoint = (tt: number) => ({ x: c.x - r * Math.cos(Math.PI * tt), y: c.y - r * 0.9 * Math.sin(Math.PI * tt) - r * 0.1 });
  const sp = sunPoint(t);
  const ink = sweep ? (lit ? "#1C1C1E" : "#fff") : scene === "plain" ? rgb(0.35, 0.25, 0.05) : rgb(0.2, 0.22, 0.24);
  const dark = scene === "plain" ? rgb(0.35, 0.25, 0.05) : rgb(0.16, 0.2, 0.26);
  const length = Math.min(r * 1.6, (r * 0.55) / Math.tan((sun.alt * Math.PI) / 180));
  const dx = Math.cos(Math.PI * t);
  const dy = 0.3;
  const norm = Math.max(0.001, Math.hypot(dx, dy));
  const tip = { x: c.x + (dx / norm) * length, y: c.y + r * 0.1 + (dy / norm) * length * 0.5 };
  // The shadow's direction on the ground, for the maps' roofs, trees and slopes.
  const sd = { x: dx / Math.hypot(dx, dy * 0.5), y: (dy * 0.5) / Math.hypot(dx, dy * 0.5) };
  const half = r * 0.17;
  const foot = sweep ? half * 0.45 : half;
  const id = (box["data-node-id"] || "sp").replace(/[^a-z0-9]/gi, "");
  const ease = dragging ? "none" : `all .5s ${SPRING}`;
  const toolbar = s(p, "toolbar");
  const place = s(p, "place").trim();
  const map = scene === "city" || scene === "terrain";
  const band = (gid: string, x1: number, y1: number, x2: number, y2: number) => (
    <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
      {SUN_SWEEP.map((col, i) => <stop key={i} offset={i / (SUN_SWEEP.length - 1)} stopColor={col} />)}
    </linearGradient>
  );
  // The ground's compass: the sun rises on the left (east) and sets on the right (west).
  const letters = [["E", c.x - r * 0.8, c.y], ["W", c.x + r * 0.8, c.y], ["S", c.x, c.y - r * 0.26], ["N", c.x, c.y + r * 0.26]] as const;
  const compassRose = letters.map(([l, x, y]) => (
    <text key={l} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600} letterSpacing=".04em" fill={ink} fillOpacity={0.45}>{l}</text>
  ));

  let dial: ReactNode;
  if (scene === "sky") {
    // Facing west over the sea: the sun comes down the band through the day and sets where it
    // meets the horizon (the ring); below it the path runs on, dotted.
    const a = { x: 0, y: h * SKY_PATH.from };
    const z = { x: w, y: h * SKY_PATH.to };
    const at = (f: number) => ({ x: a.x + (z.x - a.x) * f, y: a.y + (z.y - a.y) * f });
    const q = at(SKY_PATH.set + (1 - SKY_PATH.set) * Math.pow(1 - t, 0.8));
    const so = at(SKY_PATH.set);
    dial = (
      <g>
        {sweep ? <defs>{band(`${id}-band`, so.x, so.y, z.x, z.y)}</defs> : null}
        <line x1={a.x} y1={a.y} x2={so.x} y2={so.y} stroke={sweep ? ink : "#fff"} strokeOpacity={0.3} strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" />
        <line x1={so.x} y1={so.y} x2={z.x} y2={z.y} stroke={sweep ? `url(#${id}-band)` : "rgba(255,255,255,.7)"} strokeWidth={6} strokeLinecap="round" />
        <circle cx={q.x} cy={q.y} r={72} fill={sweep ? SUN_SWEEP[1] : "rgb(255,242,204)"} fillOpacity={sweep ? 0.3 + 0.35 * t : 0.9} filter={`url(#${id}-glow)`} />
        {/* The sun's light on the water, under it. */}
        {SKY_GLINTS.map(([off, len, y], i) => (
          <line key={i} x1={q.x + off - len / 2} x2={q.x + off + len / 2} y1={h * y} y2={h * y} stroke="#fff" strokeOpacity={0.6 * (1 - (y - 0.67) * 2.6)} strokeWidth={1.5} strokeLinecap="round" />
        ))}
        <circle cx={so.x} cy={so.y} r={7} fill="#fff" stroke={sweep ? SUN_SWEEP[0] : "#FF9500"} strokeWidth={3} />
        <circle cx={q.x} cy={q.y} r={26} fill="#fff" filter={`url(#${id}-sun)`} />
        {lit ? <circle cx={q.x} cy={q.y} r={25.25} fill="none" stroke={SUN_SWEEP[1]} strokeWidth={1.5} /> : null}
      </g>
    );
  } else {
    const arc = Array.from({ length: 61 }, (_, k) => sunPoint(k / 60)).map((q, k) => `${k ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join("");
    const baseY = c.y + half * 0.4;
    const top = baseY - half * 2.8;
    const floor = sweep && scene === "plain" ? (lit ? SUN_FIELD.floorLight : SUN_FIELD.floorDark) : map ? (sweep ? (lit ? "rgba(255,255,255,.62)" : "rgba(7,7,8,.55)") : "rgba(255,255,255,.4)") : "none";
    dial = (
      <g>
        <defs>
          {sweep ? band(`${id}-band`, c.x - r, 0, c.x + r, 0) : null}
          {/* The column's lit side faces the sun. */}
          <linearGradient id={`${id}-col`} x1={dx > 0 ? 0 : 1} y1="0" x2={dx > 0 ? 1 : 0} y2="0">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor={lit ? "#C9C9CE" : "#8E8E93"} />
          </linearGradient>
        </defs>
        <ellipse cx={c.x} cy={c.y} rx={r} ry={r * 0.42} fill={floor} stroke={ink} strokeOpacity={sweep ? 0.22 : 0.35} strokeWidth={1.5} />
        {sweep ? compassRose : null}
        <path d={arc} fill="none" stroke={sweep ? `url(#${id}-band)` : ink} strokeOpacity={sweep ? 1 : 0.6} strokeWidth={sweep ? 4 : 3} strokeLinecap="round" />
        {Array.from({ length: 11 }, (_, k) => {
          const q = sunPoint((k + 1) / 12);
          return <circle key={k} cx={q.x} cy={q.y} r={2} fill={lit ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.8)"} />;
        })}
        {scene === "plain" ? (
          <g>
            <path d={`M${c.x - foot},${baseY} L${c.x + foot},${baseY} L${tip.x + foot},${tip.y + half * 0.4} L${tip.x - foot},${tip.y + half * 0.4} Z`} fill={sweep ? "#000" : ink} fillOpacity={sweep ? (lit ? 0.2 : 0.7) : 0.55} style={{ transition: ease }} />
            {sweep ? (
              <g>
                <ellipse cx={c.x} cy={baseY} rx={foot * 1.7} ry={foot * 0.7} fill="#000" fillOpacity={lit ? 0.18 : 0.5} filter={`url(#${id}-soft)`} />
                <path d={`M${c.x - foot},${top} L${c.x - foot},${baseY} A${foot},${foot * 0.42} 0 0 0 ${c.x + foot},${baseY} L${c.x + foot},${top} Z`} fill={`url(#${id}-col)`} />
                <ellipse cx={c.x} cy={top} rx={foot} ry={foot * 0.42} fill="#fff" stroke="#000" strokeOpacity={lit ? 0.08 : 0} />
              </g>
            ) : (
              <g>
                <rect x={c.x - half} y={c.y - half * 1.4 + half * 0.25} width={half * 2} height={half * 2} rx={half * 0.25} fill="#ccc" />
                <rect x={c.x - half} y={c.y - half * 1.4} width={half * 2} height={half * 2} rx={half * 0.25} fill="#fff" />
              </g>
            )}
          </g>
        ) : (
          <g>
            <line x1={c.x} y1={c.y} x2={tip.x} y2={tip.y} stroke={sweep ? SUN_SWEEP[3] : rgb(0.45, 0.62, 0.9)} strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={tip.x} cy={tip.y} r={3.5} fill={sweep ? SUN_SWEEP[3] : rgb(0.45, 0.62, 0.9)} />
            <line x1={c.x} y1={c.y} x2={sp.x} y2={sp.y} stroke={sweep ? SUN_SWEEP[1] : "#FF9500"} strokeWidth={2.5} strokeLinecap="round" />
            {/* You are here. */}
            <circle cx={c.x} cy={c.y} r={7} fill="#fff" stroke={lit || !sweep ? "#1C1C1E" : "#070708"} strokeWidth={2.5} filter={`url(#${id}-puck)`} />
          </g>
        )}
        <circle cx={sp.x} cy={sp.y} r={13} fill="#fff" filter={`url(#${id}-sun)`} />
        {lit ? <circle cx={sp.x} cy={sp.y} r={12.25} fill="none" stroke={SUN_SWEEP[1]} strokeWidth={1.5} /> : null}
      </g>
    );
  }
  // Over a map, the ground fades out under the time and the place card so both read.
  const veil = sweep && map ? SUN_TONES[scene === "city" ? "block" : "low"][lit ? 2 : 0] : null;

  const ToolIcon = ({ children }: { children: ReactNode }) => <span style={{ display: "grid", placeItems: "center" }}>{children}</span>;
  const moved = Math.abs(minutes - now) >= 1;
  const snapBack = (e: { currentTarget: Element }) => {
    rt.haptic("light", e.currentTarget);
    setMinutes(now);
  };
  const chromeInk = lit ? "#141414" : "#fff";
  const surface = lit ? "rgba(255,255,255,.94)" : "rgba(20,20,22,.94)";
  const chromeFill = lit ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.12)";
  const chip: CSSProperties = { padding: "4px 10px", borderRadius: cr(8), background: chromeFill, fontSize: ts(13), lineHeight: "18px", fontWeight: fw(600), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

  const sweepChrome = (
    <>
      <div style={{ position: "absolute", top: card ? 18 : 64, left: card ? 16 : 20, right: card ? 16 : 20, display: "flex", flexDirection: "column", gap: 8, color: chromeInk, pointerEvents: "none" }}>
        <span style={{ fontSize: ts(12), lineHeight: "16px", fontWeight: fw(600), letterSpacing: ".04em", opacity: 0.6 }}>TODAY</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: ts(46), lineHeight: "50px", fontWeight: fw(300), fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em" }}>{clockLabel(minutes, false).slice(0, -3)}</span>
            <span style={{ fontSize: ts(20), lineHeight: "24px", fontWeight: fw(500), opacity: 0.6 }}>{clockLabel(minutes, false).slice(-2)}</span>
          </span>
          <span
            role="button"
            {...press("now")}
            onClick={snapBack}
            style={{ pointerEvents: "auto", padding: "6px 12px", borderRadius: cr(999), background: moved ? SUN_SWEEP[0] : chromeFill, color: moved ? "#fff" : chromeInk, fontSize: ts(15), lineHeight: "20px", fontWeight: fw(600), cursor: "pointer", ...pressStyle("now") }}
          >
            Now
          </span>
        </div>
        {b(p, "readouts") ? (
          <div style={{ display: "flex", gap: 8 }}>
            <span style={chip}>Shadow 1 : {sun.ratio.toFixed(2)}</span>
            <span style={chip}>{Math.round(sun.az)}° {compass(sun.az)}</span>
            <span style={chip}>{Math.round(sun.alt)}° up</span>
          </div>
        ) : null}
      </div>
      <div style={{ position: "absolute", left: card ? 16 : 20, right: card ? 16 : 20, bottom: card ? 16 : 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: chromeInk }} onPointerDown={(e) => e.stopPropagation()}>
        {toolbar === "map-pill" ? (
          <span role="button" onClick={(e) => openTool(e)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: cr(14), background: surface, fontSize: ts(15), fontWeight: fw(600), cursor: "pointer" }}>
            <MapIcon size={16} /> Map
          </span>
        ) : toolbar === "map-tools" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "11px 18px", borderRadius: cr(14), background: surface }}>
            <ToolIcon><Sun size={20} color={SUN_SWEEP[1]} fill={SUN_SWEEP[1]} /></ToolIcon>
            <ToolIcon><Search size={20} /></ToolIcon>
            <span role="button" onClick={(e) => openTool(e)} style={{ cursor: "pointer", display: "grid" }}><Layers size={20} /></span>
            <ToolIcon><LocateFixed size={20} /></ToolIcon>
          </div>
        ) : toolbar === "sky-tools" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "11px 18px", borderRadius: cr(14), background: surface }}>
            <ToolIcon><Calendar size={20} /></ToolIcon>
            <span role="button" onClick={(e) => openTool(e)} style={{ cursor: "pointer", display: "grid" }}><Scan size={20} /></span>
            <ToolIcon><Sun size={20} /></ToolIcon>
          </div>
        ) : null}
        {place ? (
          <div role="button" {...press("place")} onClick={(e) => openPlace(e)} style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: cr(20), background: surface, cursor: "pointer", ...pressStyle("place") }}>
            <span style={{ width: 30, height: 30, borderRadius: cr("50%"), flex: "none", background: `conic-gradient(${SUN_SWEEP.join(", ")}, ${SUN_SWEEP[0]})` }} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: ts(17), lineHeight: "22px", fontWeight: fw(600) }}>{place}</span>
              <span style={{ fontSize: ts(12), lineHeight: "16px", opacity: 0.6 }}>{s(p, "region")}</span>
            </span>
            <span style={{ width: 36, height: 36, borderRadius: cr("50%"), background: chromeFill, display: "grid", placeItems: "center" }}><ChevronUp size={16} strokeWidth={2.6} /></span>
          </div>
        ) : null}
      </div>
    </>
  );

  const dayChrome = (
    <>
      {b(p, "readouts") ? (
        <div style={{ position: "absolute", top: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8 }}>
          <span style={pillStyle(`color-mix(in srgb, ${dark} 80%, transparent)`)}>1 : {sun.ratio.toFixed(2)}</span>
          <span style={pillStyle(`color-mix(in srgb, ${dark} 80%, transparent)`)}>{Math.round(sun.az)}° {compass(sun.az)}</span>
          <span style={pillStyle(`color-mix(in srgb, ${dark} 80%, transparent)`)}>{Math.round(sun.alt)}°</span>
        </div>
      ) : null}
      <span style={{ ...pillStyle("#fff", "#000"), position: "absolute", left: 16, top: c.y + r * 0.45 }}>Today</span>
      <div style={{ position: "absolute", right: 16, top: c.y - r * 0.55, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: r * 0.6 }}>
        <span role="button" onPointerDown={(e) => e.stopPropagation()} onClick={snapBack} style={{ ...pillStyle(`color-mix(in srgb, ${dark} 85%, transparent)`), cursor: "pointer", opacity: moved ? 1 : 0.85 }}>
          Now
        </span>
        <span style={{ ...pillStyle("#fff", "#000"), transition: "transform .2s" }}>{clockLabel(minutes)}</span>
      </div>
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }} onPointerDown={(e) => e.stopPropagation()}>
        {toolbar === "map-pill" ? (
          <span role="button" onClick={(e) => openTool(e)} style={{ ...pillStyle(`color-mix(in srgb, ${dark} 75%, transparent)`), display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <MapIcon size={16} /> Map
          </span>
        ) : toolbar === "map-tools" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "10px 18px", borderRadius: cr(999), background: `color-mix(in srgb, ${dark} 80%, transparent)`, color: "#fff" }}>
            <ToolIcon><Sun size={20} color="#FF9500" fill="#FF9500" /></ToolIcon>
            <ToolIcon><Search size={20} /></ToolIcon>
            <span style={{ fontSize: ts(15), fontWeight: fw(700) }}>2D</span>
            <span role="button" onClick={(e) => openTool(e)} style={{ cursor: "pointer", display: "grid" }}><Layers size={20} /></span>
            <ToolIcon><Compass size={20} /></ToolIcon>
          </div>
        ) : toolbar === "sky-tools" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "10px 18px", borderRadius: cr(999), background: `color-mix(in srgb, ${dark} 70%, transparent)`, color: "#fff" }}>
            <ToolIcon><Calendar size={20} /></ToolIcon>
            <span role="button" onClick={(e) => openTool(e)} style={{ cursor: "pointer", display: "grid" }}><Scan size={20} /></span>
            <ToolIcon><Sun size={20} /></ToolIcon>
          </div>
        ) : null}
        {place ? (
          <div role="button" onClick={(e) => openPlace(e)} style={{ alignSelf: "stretch", display: "flex", alignItems: "center", padding: 8, borderRadius: cr(999), background: `color-mix(in srgb, ${dark} 85%, transparent)`, color: "#fff", cursor: "pointer", backdropFilter: "blur(10px)" }}>
            <span style={{ width: 40, height: 40, borderRadius: cr("50%"), background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center" }}><Aperture size={20} /></span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ fontSize: ts(15), fontWeight: fw(600) }}>{place}</span>
              <span style={{ fontSize: ts(11), opacity: 0.7, letterSpacing: ".02em" }}>{s(p, "region").toUpperCase()}</span>
            </span>
            <span style={{ width: 40, height: 40, borderRadius: cr("50%"), background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center" }}><Ellipsis size={20} /></span>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      {...box}
      ref={ref}
      onPointerDown={onDrag}
      style={{ ...box.style, position: "relative", alignSelf: "stretch", height: h, overflow: "hidden", borderRadius: cr(card ? corner : undefined), touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab", flex: "none", ...bleed.style }}
    >
      {bleed.strip}
      <style>{"@keyframes sp-sun-in{from{opacity:0;transform:scale(.95)}}@keyframes sp-sun-fade{from{opacity:0}}"}</style>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, display: "block", animation: still ? "sp-sun-fade .2s ease-out both" : "sp-sun-in .3s cubic-bezier(.22, 1, .36, 1) both" }} aria-label="Sun path">
        <defs>
          <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={18} /></filter>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={30} /></filter>
          <filter id={`${id}-sun`} x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={sweep ? SUN_SWEEP[1] : "#fff"} floodOpacity=".9" /></filter>
          <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={3} /></filter>
          <filter id={`${id}-puck`} x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity=".3" /></filter>
          {veil ? (
            <>
              <linearGradient id={`${id}-veil-top`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={veil} stopOpacity={0.96} /><stop offset="0.55" stopColor={veil} stopOpacity={0.7} /><stop offset="1" stopColor={veil} stopOpacity={0} /></linearGradient>
              <linearGradient id={`${id}-veil-foot`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={veil} stopOpacity={0} /><stop offset="1" stopColor={veil} stopOpacity={0.75} /></linearGradient>
            </>
          ) : null}
        </defs>
        <Scene scene={scene} w={w} h={h} id={id} sweep={sweep} lit={lit} sx={sd.x} sy={sd.y} ratio={sun.ratio} />
        {veil ? (
          <g>
            <rect width={w} height={h * 0.3} fill={`url(#${id}-veil-top)`} />
            <rect y={h * 0.74} width={w} height={h * 0.26} fill={`url(#${id}-veil-foot)`} />
          </g>
        ) : null}
        {dial}
      </svg>
      <div style={{ position: "absolute", inset: 0, animation: still ? "sp-sun-fade .2s ease-out both" : "sp-sun-in .28s cubic-bezier(.22, 1, .36, 1) 40ms both" }}>{sweep ? sweepChrome : dayChrome}</div>
    </div>
  );
};
