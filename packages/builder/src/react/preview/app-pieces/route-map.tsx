"use client";
// Route Map (definitions/app-pieces/route-map.ts): the same drawn map and arcs as the SwiftUI
// Canvas. Drag sideways to fly the followed plane along its route (a tick every tenth of the way,
// a success when it lands); past either end it rubber-bands and springs home with the release
// velocity. Tap another plane to follow it. With the camera on the plane, the map pans to keep it
// centred. Graphite follows the colour scheme.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AIRPORTS, MAP_H, MAP_STYLES as MAP_STYLES_HEX, MAP_W, PATCHES, RADAR, RADAR_DEFAULT, arc, gridLines, landPaths, parseRoutes, pinFill, project } from "../../../definitions/app-pieces/route-map.js";
import { b, n, s, useScheme, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { useDrag, useLive, useRuntime } from "../runtime.js";
import { useEdgeBleed } from "./edge-bleed.js";

/** Its table with the house red as the app accent (Style), like every other piece. */
const MAP_STYLES = accentize(MAP_STYLES_HEX);

const PLANE = "M11.5 0 L4 -1.6 L-0.5 -9.5 L-2.6 -9.5 L-0.4 -1.6 L-6.2 -1.3 L-8 -4.2 L-9.4 -4.2 L-8.4 0 L-9.4 4.2 L-8 4.2 L-6.2 1.3 L-0.4 1.6 L-2.6 9.5 L-0.5 9.5 L4 1.6 Z";
const reduced = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** A damped spring from `from` to `to`, seeded with velocity (units per second); returns a cancel. */
function springTo(from: number, to: number, v0: number, onFrame: (x: number) => void): () => void {
  let x = from;
  let v = v0;
  let last = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    v += (-170 * (x - to) - 22 * v) * dt;
    x += v * dt;
    if (Math.abs(x - to) < 0.0005 && Math.abs(v) < 0.01) return onFrame(to);
    onFrame(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
const rubber = (x: number) => (x > 1 ? 1 + Math.min(0.08, (x - 1) * 0.2) : x < 0 ? Math.max(-0.08, x * 0.2) : x);

const STARS = Array.from({ length: 40 }, (_, i) => [((i * 73) % 100) / 100, ((i * 37 + 11) % 100) / 100, (i % 3) * 0.4 + 0.6]);

export const RouteMap: Renderer = ({ p, box }) => {
  const rt = useRuntime();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(393);
  const scheme = useScheme();
  const base = MAP_STYLES[s(p, "style")] ?? MAP_STYLES.graphite;
  const light = scheme === "light" && Boolean(base.light);
  const st = light && base.light ? { ...base, ...base.light } : base;
  const hairline = light ? "#000" : "#fff";
  const planeInk = light ? "#1C1C1E" : "#fff";
  const settle = useRef<(() => void) | null>(null);
  useEffect(() => () => settle.current?.(), []);
  const radarFills = st.radar ?? RADAR_DEFAULT;
  const parsed = useMemo(() => parseRoutes(p.routes), [p.routes]);
  const seeded = useMemo(() => parsed.map((r) => r.plane), [parsed]);
  const [planes, setPlanes] = useLive(seeded);
  const [active, setActive] = useLive(Math.max(0, Math.min(parsed.length - 1, Math.round(n(p, "active")))));
  const [dragging, setDragging] = useState(false);
  const start = useRef(0);
  const height = n(p, "height") || 360;
  const bleed = useEdgeBleed(ref, b(p, "bleed"), st.space ?? st.ocean[0]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth || 393));
    ro.observe(el);
    setWidth(el.offsetWidth || 393);
    return () => ro.disconnect();
  }, []);

  const routes = parsed.map((r, i) => {
    const a = project(AIRPORTS[r.from].lon, AIRPORTS[r.from].lat);
    const z = project(AIRPORTS[r.to].lon, AIRPORTS[r.to].lat);
    return { ...r, a, z, curve: arc(a, z), plane: planes[i] ?? r.plane };
  });

  // Camera: fit the map to cover the frame, zoom, and centre on the focus point.
  const zoom = Math.max(1, n(p, "zoom") || 1);
  const fit = Math.max(width / MAP_W, height / MAP_H) * zoom;
  let center: [number, number] = [MAP_W * 0.47, MAP_H * 0.5];
  const focus = s(p, "focus");
  const followed = routes[active];
  if (followed && focus === "origin") center = followed.a;
  if (followed && focus === "plane") center = followed.curve.at(Math.min(1, Math.max(0, followed.plane ?? 0.5)));
  const globe = Boolean(st.space);
  const tx = width / 2 - center[0] * fit;
  const ty = height * (globe ? 0.55 : 0.5) - center[1] * fit;
  const px = (q: [number, number]): [number, number] => [q[0] * fit + tx, q[1] * fit + ty];

  const onDrag = useDrag({
    axis: "x",
    onStart: () => {
      settle.current?.();
      start.current = planes[active] ?? 0;
      setDragging(true);
    },
    onMove: (i) => {
      const next = rubber(start.current + i.dx / 300);
      const prev = planes[active] ?? 0;
      const tick = (x: number) => Math.floor(Math.min(1, Math.max(0, x)) * 10);
      if (tick(next) !== tick(prev)) rt.haptic(next >= 1 ? "success" : "selection", i.el);
      setPlanes((ps) => ps.map((v, k) => (k === active ? next : v)));
    },
    onEnd: (i) => {
      setDragging(false);
      const f = planes[active] ?? 0;
      const home = Math.min(1, Math.max(0, f));
      if (home === f) return;
      const k = active;
      settle.current = springTo(f, home, i.vx / 300, (x) => setPlanes((ps) => ps.map((v, j) => (j === k ? x : v))));
    },
  });

  const land = landPaths().map((poly) => "M" + poly.map((q) => px(q).map((v) => v.toFixed(1)).join(",")).join("L") + "Z").join(" ");
  const r0 = Math.min(width, height) * 0.92;
  const id = (box["data-node-id"] || "rm").replace(/[^a-z0-9]/gi, "");
  const badge = s(p, "badge").trim();
  const pins = String(p.pins ?? "").split(",").map((x) => x.trim());
  const radius = b(p, "bleed") ? 0 : n(p, "radius");

  return (
    <div
      {...box}
      ref={ref}
      onPointerDown={onDrag}
      style={{ ...box.style, position: "relative", alignSelf: "stretch", height, overflow: "hidden", borderRadius: cr(radius || undefined), background: st.space ?? st.ocean[1], touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab", ...bleed.style }}
    >
      {bleed.strip}
      <style>{"@keyframes sp-rm-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:none}}@keyframes sp-rm-fade{from{opacity:0}}"}</style>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", animation: reduced() ? "sp-rm-fade .2s ease-out both" : "sp-rm-in .3s cubic-bezier(.22, 1, .36, 1) both" }} aria-label="Flight map">
        <defs>
          <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={st.ocean[0]} />
            <stop offset="1" stopColor={st.ocean[1]} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>{globe ? <ellipse cx={width / 2} cy={height * 0.55 - r0 * 0.62 + r0} rx={r0} ry={r0} /> : <rect width={width} height={height} />}</clipPath>
          <clipPath id={`${id}-land`}><path d={land} /></clipPath>
          <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={Math.max(1.5, fit * 0.45)} /></filter>
          <filter id={`${id}-radar`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={Math.max(1.5, fit * 0.06)} /></filter>
          <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity={light ? 0.2 : 0.45} /></filter>
        </defs>
        {globe ? STARS.map(([x, y, r], i) => <circle key={i} cx={x * width} cy={y * height * 0.5} r={r * 0.7} fill="#fff" opacity={0.5} />) : null}
        {globe ? <ellipse cx={width / 2} cy={height * 0.55 - r0 * 0.62 + r0} rx={r0 + 6} ry={r0 + 6} fill="none" stroke="#4a8cff" strokeOpacity={0.35} strokeWidth={10} filter={`url(#${id}-radar)`} /> : null}
        <g clipPath={`url(#${id}-clip)`}>
          <rect width={width} height={height} fill={`url(#${id}-sea)`} />
          <path d={land} fill={st.land} />
          {st.coast ? <path d={land} fill="none" stroke={hairline} strokeOpacity={light ? 0.1 : 0.14} strokeWidth={1} /> : null}
          <g clipPath={`url(#${id}-land)`}>
            <g filter={`url(#${id}-soft)`}>
              {PATCHES.map((q, i) => {
                const [cx, cy] = px(project(q.lon, q.lat));
                const r = q.r * 0.667 * fit;
                return <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.7} fill={st.tones[q.tone]} opacity={0.7} />;
              })}
            </g>
          </g>
          {st.grid ? (
            <g stroke={hairline} strokeOpacity={light ? 0.06 : 0.07} strokeWidth={1}>
              {gridLines().map(([x1, y1, x2, y2], i) => {
                const a = px([x1, y1]);
                const z = px([x2, y2]);
                return <line key={i} x1={a[0]} y1={a[1]} x2={z[0]} y2={z[1]} />;
              })}
            </g>
          ) : null}
          {b(p, "radar") && followed ? (
            <g filter={`url(#${id}-radar)`}>
              {RADAR.map(([dx, dy, r, lvl], i) => {
                const [cx, cy] = px([followed.a[0] + 0.6 + dx * 0.9, followed.a[1] - 1.8 + dy * 0.9]);
                return <circle key={i} cx={cx} cy={cy} r={r * 0.9 * fit} fill={radarFills[lvl]} opacity={0.75} />;
              })}
            </g>
          ) : null}
          {routes.map((r, i) => {
            const a = px(r.a);
            const z = px(r.z);
            const c = px(r.curve.c);
            const tint = i === active ? st.route : st.alt ?? st.route;
            return (
              <g key={i}>
                <path d={`M${a[0]},${a[1]} Q${c[0]},${c[1]} ${z[0]},${z[1]}`} fill="none" stroke={tint} strokeOpacity={i === active ? 1 : 0.7} strokeWidth={i === active ? 3.5 : 2.5} strokeLinecap="round" />
                {[a, z].map((e, k) => (
                  <g key={k}>
                    <circle cx={e[0]} cy={e[1]} r={6} fill="#fff" />
                    <circle cx={e[0]} cy={e[1]} r={4} fill={tint} />
                  </g>
                ))}
              </g>
            );
          })}
          {b(p, "labels") && followed
            ? (() => {
                const a = px(followed.a);
                const label = `${AIRPORTS[followed.from].city}  ${followed.from}`;
                const w = label.length * 6.6 + 14;
                return (
                  <g>
                    <rect x={a[0] - w - 10} y={a[1] - 11} width={w} height={22} rx={6} fill={st.route} />
                    <text x={a[0] - w / 2 - 10} y={a[1] + 4} textAnchor="middle" fill="#fff" fontSize={ts(12)} fontWeight={fw(600)}>{label}</text>
                  </g>
                );
              })()
            : null}
          {routes.map((r, i) => {
            if (r.plane == null) return null;
            const q = px(r.curve.at(r.plane));
            const ang = (r.curve.angle(r.plane) * 180) / Math.PI;
            const pin = pins[i];
            return (
              <g
                key={`p${i}`}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (i !== active) {
                    rt.haptic("light", e.currentTarget as unknown as Element);
                    setActive(i);
                  }
                }}
              >
                <circle cx={q[0]} cy={q[1]} r={18} fill="transparent" />
                <path d={PLANE} transform={`translate(${q[0]},${q[1]}) rotate(${ang}) scale(1.35)`} fill={planeInk} filter={`url(#${id}-shadow)`} />
                {pin ? (
                  <g>
                    <circle cx={q[0]} cy={q[1] - 54} r={34} fill="#fff" opacity={0.9} />
                    <circle cx={q[0]} cy={q[1] - 54} r={30} fill={accentize(pinFill(st, pin, i))} />
                    <text x={q[0]} y={q[1] - 47} textAnchor="middle" fill={st.pinInk ?? "#fff"} fontSize={ts(20)} fontWeight={fw(700)}>{pin}</text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {badge ? (
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", padding: "6px 12px", borderRadius: cr(999), background: light ? "rgba(255,255,255,.7)" : "rgba(40,40,40,.55)", backdropFilter: "blur(12px)", color: light ? "#141414" : "#fff", fontSize: ts(12), fontWeight: fw(600), whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{badge}</div>
      ) : null}
    </div>
  );
};
