"use client";
// Number Pad: a keypad that types an amount cents-first, with a tick per key (a highlight disc and a
// 0.97 dip) and a success tap on the accent done key. Mirrors NumberPad in the export.
import { useState } from "react";
import { PAD_CURRENCIES } from "../../../definitions/app-pieces/number-pad.js";
import { Glyph } from "../../icons.js";
import { n, s, useAxis, type Renderer, cr, fw, ts } from "../env.js";
import { useLive, useRuntime, useTap } from "../runtime.js";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "delete", "0", "done"];

const DeleteKey = () => (
  <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden>
    <path d="M8.2 1h14.3A2.5 2.5 0 0 1 25 3.5v13a2.5 2.5 0 0 1-2.5 2.5H8.2a2 2 0 0 1-1.5-.7L1 10l5.7-8.3A2 2 0 0 1 8.2 1Z" fill="currentColor" />
    <path d="m12 6.5 7 7m0-7-7 7" stroke="var(--ios-bg, #fff)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const NumberPad: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const done = useTap(p.link, "success");
  const [cents, setCents] = useLive(Math.round(n(p, "amount") * 100));
  const [pressed, setPressed] = useState<string | null>(null);
  const symbol = PAD_CURRENCIES[s(p, "currency")] ?? "$";
  const note = s(p, "note").trim();
  const keyHeight = n(p, "keyHeight") || 46;
  const press = (key: string, el: Element) => {
    if (key === "done") return void done({ currentTarget: el });
    if (key === "delete") setCents((c) => Math.floor(c / 10));
    else if (cents < 10_000_000) setCents((c) => c * 10 + Number(key));
    else return void rt.haptic("warning", el);
    rt.haptic("selection", el);
  };
  const [whole, frac] = (cents / 100).toFixed(2).split(".");
  return (
    <div {...r.box} style={{ ...r.box.style, ...(axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 }), display: "flex", flexDirection: "column", alignItems: "center", gap: 16, color: "var(--ios-label)" }}>
      {note && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: ts(13), fontWeight: fw(500), color: "var(--ios-label2)" }}>
          <Glyph name="bookmark" size={14} /> {note}
        </span>
      )}
      <span style={{ fontSize: ts(44), fontWeight: fw(500), letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>
        {symbol}{Number(whole).toLocaleString("en-US")}.{frac}
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", rowGap: 6, alignSelf: "stretch" }}>
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onPointerDown={() => setPressed(key)}
            onPointerUp={() => setPressed(null)}
            onPointerLeave={() => setPressed(null)}
            onClick={(e) => press(key, e.currentTarget)}
            aria-label={key}
            style={{
              minHeight: keyHeight, border: 0, background: "transparent", color: "inherit", cursor: "pointer", display: "grid", placeItems: "center", fontSize: ts(24), fontFamily: "inherit",
              position: "relative", transform: pressed === key ? "scale(.97)" : undefined, transition: "transform .12s ease-out",
            }}
          >
            <span aria-hidden style={{ position: "absolute", width: 56, height: 56, borderRadius: cr(28), background: "var(--ios-label2)", opacity: pressed === key ? 0.18 : 0, transition: "opacity .12s ease-out" }} />
            <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
              {key === "delete" ? <DeleteKey /> : key === "done" ? <span style={{ color: "var(--ios-accent)", display: "grid" }}><Glyph name="checkmark.circle.fill" size={30} strokeWidth={2.2} /></span> : key}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
