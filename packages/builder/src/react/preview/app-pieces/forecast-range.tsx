"use client";
import { useEffect, useState } from "react";
import { parseForecast, temperatureRGB } from "../../../definitions/app-pieces/forecast-range.js";
import { Glyph } from "../../icons.js";
import { s, type Renderer, fw, ts } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { LABEL, LABEL2, SEP, WideRoot, useHaptic } from "./data-kit.js";

// Forecast Range (definitions/app-pieces/forecast-range.ts): the capsules grow from their lows as
// the list appears (0.6 s ease-out); a tap opens a day's detail with a selection tick.
export const ForecastRange: Renderer = (r) => {
  const days = parseForecast(r.p.days);
  const fahrenheit = s(r.p, "scale") === "fahrenheit";
  const unit = s(r.p, "unit") || "°";
  const nowText = s(r.p, "now").trim();
  const now = r.p.showsNow !== false && nowText !== "" && Number.isFinite(Number(nowText)) ? Number(nowText) : null;
  const floor = days.length ? Math.min(...days.map((d) => d.low)) : 0;
  const ceiling = Math.max(floor + 1, days.length ? Math.max(...days.map((d) => d.high)) : 1);
  const span = ceiling - floor;
  const [grown, setGrown] = useState(reducedMotion());
  const [open, setOpen] = useState(-1);
  const haptic = useHaptic();
  useEffect(() => {
    const t = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const rgb = (t: number) => `rgb(${temperatureRGB(t, fahrenheit).join(",")})`;
  const num = { fontSize: ts(17), fontWeight: fw(500), fontVariantNumeric: "tabular-nums" as const, width: 38, flex: "none" };
  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", color: LABEL }}>
      {days.map((d, i) => (
        <div
          key={i}
          onClick={(e) => {
            haptic("selection", e.currentTarget);
            setOpen((o) => (o === i ? -1 : i));
          }}
          style={{ padding: "11px 0", borderTop: i ? `0.5px solid ${SEP}` : undefined, cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 56, flex: "none", fontSize: ts(17), fontWeight: fw(500), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
            <span style={{ width: 34, flex: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Glyph name={d.symbol} size={19} style={{ color: d.symbol.startsWith("sun") ? "#F5B82E" : d.symbol.includes("rain") || d.symbol.includes("bolt") ? "#6CC4F5" : undefined }} />
              {d.precip ? <span style={{ fontSize: ts(11), fontWeight: fw(600), color: "#32ADE6" }}>{d.precip}</span> : null}
            </span>
            <span style={{ ...num, textAlign: "right", color: LABEL2 }}>{Math.round(d.low)}{unit}</span>
            <span style={{ position: "relative", flex: 1, height: 6, borderRadius: 3, background: "var(--ios-fill)" }}>
              <span
                style={{
                  position: "absolute", top: 0, bottom: 0, borderRadius: 3,
                  left: `${((d.low - floor) / span) * 100}%`,
                  width: grown ? `max(6px, ${((d.high - d.low) / span) * 100}%)` : 6,
                  background: `linear-gradient(90deg, ${rgb(d.low)}, ${rgb(d.high)})`,
                  transition: "width .6s cubic-bezier(.23,1,.32,1)",
                }}
              />
              {i === 0 && now !== null ? (
                <span style={{ position: "absolute", top: -2, width: 10, height: 10, borderRadius: 5, background: "#fff", boxShadow: "0 0 0 1.5px rgba(0,0,0,.3)", left: `calc(${Math.min(1, Math.max(0, (now - floor) / span)) * 100}% - 5px)` }} />
              ) : null}
            </span>
            <span style={num}>{Math.round(d.high)}{unit}</span>
          </div>
          {open === i && d.detail ? <span className="spa-rise" style={{ fontSize: ts(15), color: LABEL2 }}>{d.detail}</span> : null}
        </div>
      ))}
    </WideRoot>
  );
};
