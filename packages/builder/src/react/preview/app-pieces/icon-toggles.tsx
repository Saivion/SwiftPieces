"use client";
// Icon Toggles: round icon buttons that fill with the tint when on, with a small spring.
import { startsOn, sweepHex, toggleItems } from "../../../definitions/app-pieces/icon-toggles.js";
import { Glyph } from "../../icons.js";
import { n, paint, s, type Renderer, cr, ts } from "../env.js";
import { useLive } from "../runtime.js";
import { EASE_OUT, PRESS_TRANSITION, Root, enter, press, stagger, useHaptic } from "./wellbeing-shared.js";

export const IconToggles: Renderer = (r) => {
  const items = toggleItems(r.p);
  const [on, setOn] = useLive<string>(startsOn(r.p).join(","));
  const set = new Set(on.split(",").filter(Boolean).map(Number));
  const tint = sweepHex(r.p) ?? paint(s(r.p, "tint") || "accent", r.scheme);
  const size = n(r.p, "size") || 46;
  const haptic = useHaptic();
  const flip = (i: number, el: Element) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setOn([...next].join(","));
    haptic("selection", el);
  };
  return (
    <Root r={r} style={{ alignSelf: "stretch", display: "flex", alignItems: "flex-start", userSelect: "none" }}>
      {items.map((it, i) => {
        const active = set.has(i);
        return (
          <button key={i} type="button" data-spw-anim="pop" {...press} aria-pressed={active} onClick={(e) => flip(i, e.currentTarget)} style={{ all: "unset", ...enter("pop", stagger(i)).style, flex: 1, minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", transition: PRESS_TRANSITION }}>
            <span
              style={{
                width: size,
                height: size,
                borderRadius: cr("50%"),
                display: "grid",
                placeItems: "center",
                background: active ? tint : "transparent",
                color: active ? "#fff" : tint,
                boxShadow: active ? undefined : `inset 0 0 0 1.5px color-mix(in srgb, ${tint} 45%, transparent)`,
                transform: `scale(${active ? 1.06 : 1})`,
                transition: `transform .25s ${EASE_OUT}, background-color .15s, color .15s`,
              }}
            >
              <Glyph name={it.icon} size={Math.round(size * 0.46)} strokeWidth={2} />
            </span>
            <span style={{ fontSize: ts(11), lineHeight: "13px", color: "var(--ios-label2)", textAlign: "center", maxWidth: size + 18 }}>{it.label}</span>
          </button>
        );
      })}
    </Root>
  );
};
