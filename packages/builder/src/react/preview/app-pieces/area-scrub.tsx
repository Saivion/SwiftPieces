"use client";
import { useRef } from "react";
import { clockLabel, valueAt } from "../../../definitions/app-pieces/area-scrub.js";
import { numbers, smoothPath, tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { n, s, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { useDrag, useLive } from "../runtime.js";
import { LABEL, LABEL2, WideRoot, useHaptic, useWidth } from "./data-kit.js";

export const AreaScrub: Renderer = (r) => {
  const values = numbers(s(r.p, "values"));
  const vals = values.length > 1 ? values : [0, 1];
  const start = n(r.p, "startHour");
  const end = Math.max(start + 1, n(r.p, "endHour"));
  const h = n(r.p, "height") || 320;
  const unit = s(r.p, "unit");
  const note = s(r.p, "note").trim();
  const color = accentize(tintHex(s(r.p, "tint"), "ember"));
  const [ref, w] = useWidth();
  const [hour, setHour] = useLive(n(r.p, "hour"));
  const haptic = useHaptic();
  const lastHour = useRef(Math.floor(hour));

  const lo = Math.min(...vals) - 6;
  const hi = Math.max(...vals) + 2;
  const x = (i: number) => (w * i) / (vals.length - 1);
  const y = (v: number) => h * 0.35 + (1 - (v - lo) / (hi - lo || 1)) * h * 0.65;
  const pts = vals.map((v, i) => [x(i), y(v)] as [number, number]);
  const area = `${smoothPath(pts, 0.5)} L${w},${h} L0,${h} Z`;
  const lineX = (w * (hour - start)) / (end - start);
  const peak = vals.indexOf(Math.max(...vals));
  const reading = Math.round(valueAt(vals, hour, start, end));

  const set = (px: number, el: Element) => {
    const f = Math.max(0, Math.min(1, px / w));
    const next = start + f * (end - start);
    if (Math.floor(next) !== lastHour.current) {
      lastHour.current = Math.floor(next);
      haptic("selection", el);
    }
    setHour(next);
  };
  const drag = useDrag({ slop: 0, axis: "x", onStart: ({ x: px, el }) => set(px, el), onMove: ({ x: px, el }) => set(px, el) });
  const clock = clockLabel(hour);

  return (
    <WideRoot r={r} style={{ color: LABEL }}>
      <div ref={ref} onPointerDown={drag} style={{ position: "relative", height: h, touchAction: "pan-y", cursor: "ew-resize" }}>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          <g className="spa-enter" style={{ transformBox: "fill-box", transformOrigin: "bottom" }}><path d={area} fill={color} fillOpacity={0.5} /></g>
        </svg>
        <span style={{ position: "absolute", left: Math.min(Math.max(x(peak), 30), w - 30), top: y(vals[peak]) - 44, transform: "translateX(-50%)", fontSize: ts(22), lineHeight: "28px", fontVariantNumeric: "tabular-nums" }}>{Math.round(vals[peak])}{unit}</span>
        <span style={{ position: "absolute", right: 6, top: y(vals[vals.length - 1]) + 12, fontSize: ts(22), lineHeight: "28px", fontVariantNumeric: "tabular-nums" }}>{Math.round(vals[vals.length - 1])}{unit}</span>
        {note ? <span style={{ position: "absolute", left: w * 0.3, bottom: 12, transform: "translateX(-50%)", fontSize: ts(20), lineHeight: "25px", whiteSpace: "nowrap" }}>{note}</span> : null}
        <div style={{ position: "absolute", left: lineX - 1.5, top: 60, bottom: 0, width: 3, background: LABEL, borderRadius: cr(2) }} />
        <div style={{ position: "absolute", left: lineX - 11, top: 49, width: 22, height: 22, borderRadius: cr(11), background: LABEL }} />
        <span style={{ position: "absolute", top: 0, left: Math.min(Math.max(lineX - 50, 0), w - 180), display: "flex", alignItems: "baseline", gap: 8, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontSize: ts(28), fontWeight: fw(500), lineHeight: "32px" }}>{clock}</span>
          <span style={{ fontSize: ts(20), fontWeight: fw(600), lineHeight: "25px", color: LABEL2 }}>{reading}{unit}</span>
        </span>
      </div>
    </WideRoot>
  );
};
