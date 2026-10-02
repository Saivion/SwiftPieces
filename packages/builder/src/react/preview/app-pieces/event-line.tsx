"use client";
import { useState } from "react";
import { tintHex } from "../../../definitions/app-pieces/data-kit.js";
import { Glyph } from "../../icons.js";
import { s, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { useLive, useTap } from "../runtime.js";
import { LABEL, LABEL2, WideRoot, useHaptic } from "./data-kit.js";
import { EASE_OUT, pressBind } from "./entrance.js";

export const EventLine: Renderer = (r) => {
  const style = s(r.p, "style") || "plain";
  const todo = r.p.todo === true;
  const [done, setDone] = useLive(todo && r.p.done === true);
  const [down, setDown] = useState(false);
  const color = accentize(tintHex(s(r.p, "tint"), "ember"));
  const detail = s(r.p, "detail").trim();
  const chip = style === "chip";
  const card = style !== "plain";
  const tap = useTap(r.p.link);
  const haptic = useHaptic();
  const dark = r.scheme === "dark";
  return (
    <WideRoot
      r={r}
      hug={chip}
      className={`${r.box.className ?? ""} spa-enter`}
      {...pressBind(setDown)}
      onClick={(e) => {
        if (todo) {
          const next = !done;
          setDone(next);
          if (next) haptic("success", e.currentTarget);
        } else tap(e);
      }}
      style={{
        display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none", color: LABEL,
        padding: !card ? 0 : chip ? "8px 16px" : "16px 16px",
        borderRadius: cr(chip ? 20 : 16),
        background: card ? (dark ? "#141416" : "#FFFFFF") : undefined,
        boxShadow: card && !dark ? "0 1px 2px rgba(0,0,0,.05)" : undefined,
        transform: card && down ? "scale(.97)" : "none", opacity: !card && down ? 0.6 : 1,
        transition: `transform ${down ? ".12s" : ".2s"} ${EASE_OUT}, opacity ${down ? ".12s" : ".2s"} ${EASE_OUT}`,
        ...(chip ? { alignSelf: "flex-start" } : {}),
      }}
    >
      <span
        style={{
          width: todo && done ? 20 : chip ? 10 : 8, height: chip ? 16 : detail ? 36 : 24, borderRadius: cr(10), flex: "none",
          background: todo && !done ? LABEL : color, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", transition: `width .3s ${EASE_OUT}, background .2s`,
        }}
      >
        {todo && done ? <Glyph name="checkmark" size={11} strokeWidth={3.5} /> : null}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: ts(17), lineHeight: "22px", fontWeight: fw(chip ? 400 : 600), textDecoration: done ? "line-through" : undefined, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s(r.p, "title")}</span>
        {detail ? <span style={{ fontSize: ts(13), lineHeight: "18px", color: LABEL2, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{detail}</span> : null}
      </div>
    </WideRoot>
  );
};
