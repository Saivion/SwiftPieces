"use client";
import { useEffect, useState } from "react";
import { BUBBLES } from "../../../definitions/app-pieces/chat-bubble.js";
import { s, type Renderer, cr, ts, accentize } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { LABEL2, WideRoot, useHaptic } from "./data-kit.js";
import { pressBind, pressStyle } from "./entrance.js";

export const ChatBubble: Renderer = (r) => {
  const out = s(r.p, "side") === "trailing";
  const b = accentize(BUBBLES[s(r.p, "fill")] ?? BUBBLES.ink);
  const [fill, ink] = r.scheme === "light" && b.light ? b.light : [b.fill, b.ink];
  const words = s(r.p, "text").split(" ");
  const reveal = r.p.reveal === true;
  const [shown, setShown] = useState(reveal ? 0 : words.length);
  const [time, setTime] = useState(false);
  const [down, setDown] = useState(false);
  const haptic = useHaptic();
  const text = s(r.p, "text");

  useEffect(() => {
    if (!reveal || reducedMotion()) {
      setShown(words.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= words.length) clearInterval(id);
    }, 70);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, text]);

  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start", gap: 4, [out ? "paddingLeft" : "paddingRight"]: 44, boxSizing: "border-box" }}>
      <div className="spa-enter" style={{ transformOrigin: out ? "bottom right" : "bottom left" }}>
        <div
          {...pressBind(setDown)}
          onClick={(e) => {
            haptic("selection", e.currentTarget);
            setTime((v) => !v);
          }}
          style={{ background: fill, color: ink, borderRadius: cr(20), padding: "12px 16px", fontSize: ts(17), lineHeight: "22px", cursor: "pointer", userSelect: "none", boxShadow: r.scheme === "light" && fill.toUpperCase() === "#FFFFFF" ? "0 1px 2px rgba(0,0,0,.05)" : undefined, ...pressStyle(down), transformOrigin: out ? "bottom right" : "bottom left" }}
        >
          {words.map((w, i) => (
            <span key={i} style={{ opacity: i < shown ? 1 : 0, transition: "opacity .15s" }}>{w}{i < words.length - 1 ? " " : ""}</span>
          ))}
        </div>
      </div>
      {time && s(r.p, "sent").trim() ? <span className="spa-enter" style={{ fontSize: ts(11), lineHeight: "13px", color: LABEL2 }}>{s(r.p, "sent")}</span> : null}
    </WideRoot>
  );
};
