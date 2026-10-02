"use client";
// Place Map in the preview: the same 400-point drawing the Swift scales to fill and clips. Drags
// pan it (rubber-banding past the edges; a flick springs to where it was heading, kept inside), a
// pin tap calls out its name with a spring and a selection haptic, and the locate button springs
// the map back. Graphite follows the colour scheme.
import { useState } from "react";
import { PLACE_MAP, placeColors, placeIsDark, placePins, placeStreets } from "../../../definitions/app-pieces/place-map.js";
import { list } from "../../../core/swift.js";
import { Glyph } from "../../icons.js";
import { b, fillStyle, n, s, useAxis, useScheme, type Renderer, cr, ff, fw, ts, accentize } from "../env.js";
import { BOUNCE, SPRING, useDrag, useRuntime } from "../runtime.js";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rubber = (x: number) => (Math.abs(x) <= 90 ? x : Math.sign(x) * (90 + (Math.abs(x) - 90) * 0.3));

export const PlaceMap: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const scheme = useScheme();
  const dark = placeIsDark(s(p, "appearance"), scheme);
  const c = accentize(placeColors(s(p, "appearance"), scheme));
  const [pressedLocate, setPressedLocate] = useState(false);
  const pins = accentize(placePins(p.pins, s(p, "appearance"), p.symbols, p.tints));
  const areas = list(p.areas, 4);
  const symbols = s(p, "marker") === "symbols";
  const height = n(p, "height");
  const startSel = Math.round(n(p, "selected"));
  const [selected, setSelected] = useState<number | null>(startSel >= 0 && startSel < pins.length ? startSel : null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [base, setBase] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useDrag({
    onStart: () => setDragging(true),
    onMove: ({ dx, dy }) => setPan({ x: rubber(base.x + dx), y: rubber(base.y + dy) }),
    onEnd: ({ dx, dy, vx, vy }) => {
      // Where the flick was heading (about a fifth of a second on), kept inside the map.
      const home = { x: clamp(base.x + dx + vx * 0.2, -90, 90), y: clamp(base.y + dy + vy * 0.2, -90, 90) };
      setDragging(false);
      setPan(home);
      setBase(home);
    },
  });
  const pick = (i: number, el: Element) => {
    rt.haptic("selection", el);
    setSelected((cur) => (cur === i ? null : i));
  };
  const center = pins[0];

  return (
    <div {...r.box} style={{ ...r.box.style, position: "relative", height, borderRadius: "calc(20px * var(--spb-corner, 1))", overflow: "hidden", background: c.land, touchAction: "none", ...fillStyle(true, axis) }} onPointerDown={drag}>
      <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: "block", cursor: dragging ? "grabbing" : "grab" }}>
        <g style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, transition: dragging ? "none" : `transform .45s ${SPRING}` }}>
          <rect x="-100" y="-100" width="600" height="600" fill={c.land} />
          {PLACE_MAP.rivers.map((d) => (
            <path key={d} d={d} fill={c.water} />
          ))}
          <path d={PLACE_MAP.park} fill={c.park} />
          {placeStreets().map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.street} strokeOpacity={0.8} strokeWidth={1.2} />
          ))}
          {areas.map((a, i) => (
            <text key={a} x={PLACE_MAP.areas[i][0]} y={PLACE_MAP.areas[i][1]} fontSize={ts(PLACE_MAP.areas[i][2])} fontWeight={fw(600)} fill={c.label} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: ff("system-ui, -apple-system") }}>
              {a}
            </text>
          ))}
          {b(p, "rings") && center
            ? PLACE_MAP.rings.map((rad, i) => (
                <g key={rad}>
                  <circle cx={center.x} cy={center.y} r={rad} fill="none" stroke={c.ring} strokeOpacity={0.55} strokeWidth={1.4} />
                  {/* Beside each ring on the right, along the centre line: the side no pin's name reaches. */}
                  <text x={center.x + rad + 14} y={center.y} fontSize={ts(13)} fontWeight={fw(700)} fill={c.ring} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: ff("system-ui, -apple-system") }}>
                    {i + 1}mi
                  </text>
                </g>
              ))
            : null}
        </g>
      </svg>
      {/* Pins in HTML over the map so they keep their size; placed with the same slice maths. */}
      <PinLayer pins={pins} pan={pan} dragging={dragging} selected={selected} symbols={symbols} dark={dark} onPick={pick} />
      {b(p, "controls") ? (
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0", width: 44, borderRadius: cr(22), background: dark ? "rgba(40,40,44,.85)" : "rgba(255,255,255,.88)", color: dark ? "#fff" : "#111", backdropFilter: "blur(10px)" }}>
          <span style={{ height: 40, display: "grid", placeItems: "center" }}><Glyph name="map" size={18} strokeWidth={2.2} /></span>
          <button
            type="button"
            aria-label="Recenter"
            onPointerDown={(e) => {
              e.stopPropagation();
              setPressedLocate(true);
            }}
            onPointerUp={() => setPressedLocate(false)}
            onPointerLeave={() => setPressedLocate(false)}
            onClick={(e) => {
              rt.haptic("light", e.currentTarget);
              setPan({ x: 0, y: 0 });
              setBase({ x: 0, y: 0 });
            }}
            style={{ background: "none", border: 0, padding: 0, width: 44, height: 40, color: "inherit", cursor: "pointer", display: "grid", placeItems: "center", transform: pressedLocate ? "scale(.97)" : undefined, opacity: pressedLocate ? 0.6 : 1, transition: "transform .12s ease-out, opacity .12s ease-out" }}
          >
            <Glyph name="location" size={18} strokeWidth={2.2} />
          </button>
        </div>
      ) : null}
    </div>
  );
};

function PinLayer({ pins, pan, dragging, selected, symbols, dark, onPick }: { pins: ReturnType<typeof placePins>; pan: { x: number; y: number }; dragging: boolean; selected: number | null; symbols: boolean; dark: boolean; onPick: (i: number, el: Element) => void }) {
  const still = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The SVG is sliced to fill: a 400 square scaled by max(w, h) / 400 and centred. Percent
  // positions reproduce that with CSS: left = 50% + (x - 200) * k, where k comes from the box.
  return (
    <div style={{ position: "absolute", inset: 0, containerType: "size", pointerEvents: "none" }}>
      <style>{"@keyframes sp-pm-pop{from{opacity:0;transform:translateY(-6px) scale(.95)}}@keyframes sp-pm-fade{from{opacity:0}}"}</style>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${pan.x}px, ${pan.y}px)`, transition: dragging ? "none" : `transform .45s ${SPRING}` }}>
        {pins.map((pin, i) => {
          const on = selected === i;
          return (
            <button
              key={pin.name + i}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => onPick(i, e.currentTarget)}
              style={{
                position: "absolute",
                left: `calc(50% + ${pin.x - 200} * max(100cqw, 100cqh) / 400)`,
                top: `calc(50% + ${pin.y - 200} * max(100cqw, 100cqh) / 400)`,
                transform: `translate(-50%, -13px) scale(${on ? 1.15 : 1})`,
                transformOrigin: "50% 13px",
                transition: `transform .35s ${BOUNCE}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
                pointerEvents: "auto",
                zIndex: on ? 2 : 1,
              }}
            >
              <span style={{ animation: still ? "sp-pm-fade .2s ease-out both" : `sp-pm-pop .28s cubic-bezier(.22, 1, .36, 1) ${Math.min(i, 7) * 40}ms both`, width: 26, height: 26, borderRadius: cr(13), background: pin.color, border: "2px solid #fff", boxSizing: "border-box", color: pin.ink, display: "grid", placeItems: "center", fontSize: ts(13), fontWeight: fw(700), boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}>
                {symbols ? <Glyph name={pin.symbol} size={13} strokeWidth={2.6} /> : pin.number}
              </span>
              <span
                style={{
                  animation: still ? "sp-pm-fade .2s ease-out both" : `sp-pm-pop .28s cubic-bezier(.22, 1, .36, 1) ${Math.min(i, 7) * 40}ms both`,
                  fontSize: ts(on ? 13 : 10),
                  fontWeight: fw(700),
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: on ? 160 : 104,
                  padding: on ? "4px 8px" : 0,
                  borderRadius: cr(12),
                  background: on ? (dark ? "rgba(40,40,44,.9)" : "rgba(255,255,255,.92)") : "transparent",
                  color: dark ? "#fff" : "#1c1c1e",
                  textShadow: on ? undefined : dark ? "0 0 3px #000" : "0 0 3px #fff, 0 0 3px #fff",
                  transition: "font-size .2s, padding .2s",
                }}
              >
                {pin.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
