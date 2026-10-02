"use client";
import { useState } from "react";
import { badgeFill } from "../../../definitions/app-pieces/plan-row.js";
import { tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { Glyph } from "../../icons.js";
import { s, type Renderer, cr, fw, ts, ACCENT, accentize } from "../env.js";
import { useLive, useTap } from "../runtime.js";
import { LABEL, LABEL2, WideRoot, useHaptic } from "./data-kit.js";
import { EASE_OUT, pressBind } from "./entrance.js";

export const PlanRow: Renderer = (r) => {
  const themed = s(r.p, "surface") !== "light";
  const dark = themed && r.scheme === "dark";
  const checkable = r.p.checkable !== false;
  const [done, setDone] = useLive(checkable && r.p.done === true);
  const [pop, setPop] = useState(0);
  const [pressed, setPressed] = useState(false);
  const haptic = useHaptic();
  const tap = useTap(r.p.link);
  const detail = s(r.p, "detail").trim();
  const pastel = s(r.p, "badgeStyle") === "pastel";
  const hue = accentize(tintHex(s(r.p, "badge"), "ember"));
  const ink = dark ? "#fff" : themed ? LABEL : "#141414";
  return (
    <WideRoot
      r={r}
      className={`${r.box.className ?? ""} spa-enter`}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: cr(20),
        // In a styled list (Style → Lists) the list draws the surface.
        background: r.p.listed === true ? "transparent" : dark ? "#141416" : "#fff",
        boxShadow: r.p.listed === true ? "none" : dark ? "inset 0 0 0 1px rgba(255,255,255,.07), 0 4px 16px rgba(0,0,0,.4)" : "0 1px 2px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.06)",
        color: ink,
        transform: pressed ? "scale(.97)" : "none", transition: `transform ${pressed ? ".12s" : ".2s"} ${EASE_OUT}`,
      }}
    >
      <div
        {...pressBind(setPressed)}
        onClick={(e) => tap(e)}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, cursor: r.p.link ? "pointer" : undefined, opacity: done ? 0.75 : 1, transition: "opacity .3s" }}
      >
        <span style={{ width: 44, height: 44, borderRadius: cr(22), flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: pastel ? badgeFill(s(r.p, "badge"), dark) : `color-mix(in srgb, ${hue} 20%, transparent)`, color: pastel ? "rgba(0,0,0,.72)" : hue }}>
          <Glyph name={s(r.p, "symbol") || "sun.max"} size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: ts(17), fontWeight: fw(600), lineHeight: "22px", textDecoration: done ? "line-through" : undefined, color: done ? (dark ? "rgba(255,255,255,.6)" : LABEL2) : undefined, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s(r.p, "title")}</span>
          {detail ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ts(15), lineHeight: "20px", color: dark ? "rgba(255,255,255,.72)" : LABEL2, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {r.p.calendarIcon === true ? <Glyph name="calendar" size={14} /> : null}
              {detail}
            </span>
          ) : null}
        </div>
      </div>
      {checkable ? (
        <span
          role="button"
          aria-pressed={done}
          onClick={(e) => {
            const next = !done;
            setDone(next);
            setPop((k) => k + 1);
            if (next) haptic("success", e.currentTarget);
          }}
          style={{ width: 44, height: 44, flex: "none", display: "grid", placeItems: "center", cursor: "pointer", margin: "-8px -8px -8px 0" }}
        >
          <span
            key={pop}
            className={pop ? "spa-enter" : undefined}
            style={{
              width: 26, height: 26, borderRadius: cr(13), display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: done ? undefined : `inset 0 0 0 2px ${ink}`,
              background: done ? (themed ? ACCENT : LABEL) : undefined, color: themed ? "#fff" : "var(--ios-bg)",
            }}
          >
            {done ? <Glyph name="checkmark" size={15} strokeWidth={3} /> : null}
          </span>
        </span>
      ) : null}
    </WideRoot>
  );
};
