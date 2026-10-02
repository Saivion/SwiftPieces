"use client";
// Balance Panel: a colour panel with what's left, tapping between the month and today (the digits
// roll in 0.25 s), a ring of the days left, and round actions that dip to 0.97; the add button is
// the accent. The card surface follows light and dark. Mirrors BalancePanel in the export.
import { useEffect, useState } from "react";
import { blockColor } from "../../../definitions/app-pieces/color-block-list.js";
import { Glyph } from "../../icons.js";
import { n, s, useAxis, type Renderer, cr, fw, ts } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { useRuntime, useTap } from "../runtime.js";
import { useFirstAppearance } from "./first-appearance.js";

const INK = "rgba(0,0,0,.82)";
const mixBlack = (hex: string, by: number) => {
  const v = hex.replace("#", "");
  const c = (i: number) => Math.round(parseInt(v.slice(i, i + 2), 16) * (1 - by));
  return `rgb(${c(0)}, ${c(2)}, ${c(4)})`;
};

function Money({ value }: { value: number }) {
  const [whole, frac] = Math.abs(value).toFixed(2).split(".");
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", fontVariantNumeric: "tabular-nums" }}>
      <span style={{ fontSize: ts(54), fontWeight: fw(600), letterSpacing: -1.5 }}>{value < 0 ? "-" : ""}${Number(whole).toLocaleString("en-US")}</span>
      <span style={{ fontSize: ts(24), fontWeight: fw(600) }}>.{frac}</span>
    </span>
  );
}

export const BalancePanel: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const [alt, setAlt] = useState(false);
  const hasAlt = n(p, "altAmount") !== 0;
  const target = alt && hasAlt ? n(p, "altAmount") : n(p, "amount");
  const [shown, setShown] = useState(target);
  const still = reducedMotion();
  // The digits roll to the new amount when it flips, like .contentTransition(.numericText()).
  useEffect(() => {
    if (still) {
      setShown(target);
      return;
    }
    let raf = 0;
    const from = shown;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 250);
      setShown(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const flip = (el: Element) => {
    if (!hasAlt) return;
    rt.haptic("selection", el);
    setAlt((a) => !a);
  };
  const settings = useTap(p.settingsLink);
  const transfer = useTap(p.transferLink);
  const add = useTap(p.addLink, "medium");
  const list = useTap(p.listLink);
  const fill = blockColor(s(p, "fill"));
  const dark = s(p, "surface") !== "block";
  const bleed = n(p, "bleed");
  const days = n(p, "daysLeft");
  const frac = Math.min(1, days / Math.max(1, n(p, "daysInPeriod")));
  // The panel eases in from 0.95 and the ring sweeps round on appear.
  const swept = useFirstAppearance(r.node.id);
  const [down, setDown] = useState<string | null>(null);
  const light = r.scheme === "light";
  const top = light ? "#FFFFFF" : "#141416";
  const bottom = light ? "#ECEBE6" : "#1C1C1F";
  const C = 2 * Math.PI * 50;
  const icon = { border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 6, display: "grid", placeItems: "center", transition: "transform .12s ease-out, opacity .12s ease-out" } as const;
  // Every button dips to 0.97 and dims a little under the finger (BalancePanelPress).
  const press = (id: string) => ({
    onPointerDown: () => setDown(id),
    onPointerUp: () => setDown(null),
    onPointerLeave: () => setDown(null),
  });
  const pressed = (id: string) => (down === id ? { transform: "scale(.97)", opacity: 0.7 } : {});
  return (
    <div
      {...r.box}
      style={{
        ...r.box.style, ...(axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 }), margin: bleed ? `0 -${bleed}px` : undefined,
        flex: "1 1 auto", minHeight: n(p, "height"), display: "flex", flexDirection: "column", color: dark ? "var(--ios-label)" : INK,
        borderRadius: cr(dark ? 24 : 0), overflow: dark ? "hidden" : undefined,
        opacity: swept ? 1 : 0, transform: swept || still ? undefined : "scale(.95)", transition: `opacity ${still ? 0.2 : 0.3}s ease-out, transform .3s ease-out`,
      }}
    >
      <div style={{ flex: 1, background: dark ? top : fill, padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" {...press("settings")} style={{ ...icon, ...pressed("settings") }} onClick={(e) => settings(e)} aria-label="Settings"><Glyph name="gearshape" size={18} /></button>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: ts(15), fontWeight: fw(600) }}>
            {dark ? <i style={{ width: 8, height: 8, borderRadius: cr(4), background: fill }} /> : null}
            {s(p, "title")}
          </span>
          <button type="button" {...press("switch")} style={{ ...icon, ...pressed("switch") }} onClick={(e) => flip(e.currentTarget)} aria-label="Switch"><Glyph name="arrow.clockwise" size={18} /></button>
        </div>
        <button type="button" {...press("amount")} onClick={(e) => flip(e.currentTarget)} style={{ ...icon, ...pressed("amount"), flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
          <Money value={shown} />
          <span key={String(alt)} style={{ fontSize: ts(13), animation: alt || shown !== target ? "spb-bp-in .2s ease-out" : undefined }}>{alt && hasAlt ? s(p, "altCaption") : s(p, "caption")}</span>
        </button>
      </div>
      <div style={{ flex: 1, background: dark ? bottom : mixBlack(fill, 0.1), display: "flex", flexDirection: "column", alignItems: "center", padding: "0 28px 20px" }}>
        <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
          <div style={{ position: "relative", width: 104, height: 104 }}>
            <svg width="104" height="104" viewBox="0 0 104 104" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden>
              <circle cx="52" cy="52" r="50" fill="none" stroke={dark ? fill : "rgba(255,255,255,.35)"} strokeOpacity={dark ? 0.25 : 1} strokeWidth="4" />
              <circle cx="52" cy="52" r="50" fill="none" stroke={dark ? fill : "#fff"} strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (swept || still ? frac : 0))} style={{ transition: "stroke-dashoffset .3s ease-out" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: ts(28), fontWeight: fw(600), lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{days}</span>
              <span style={{ fontSize: ts(11) }}>{s(p, "ringCaption")}</span>
            </div>
          </div>
        </div>
        <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" {...press("transfer")} style={{ ...icon, ...pressed("transfer") }} onClick={(e) => transfer(e)} aria-label="Transfer"><Glyph name="arrow.left.arrow.right" size={20} /></button>
          <button type="button" {...press("add")} onClick={(e) => add(e)} aria-label="Add" style={{ ...icon, ...pressed("add"), width: 58, height: 58, borderRadius: cr(29), background: dark ? "var(--ios-accent)" : "rgba(255,255,255,.3)", color: dark ? "#fff" : undefined }}>
            <Glyph name="plus" size={26} strokeWidth={2.4} />
          </button>
          <button type="button" {...press("list")} style={{ ...icon, ...pressed("list") }} onClick={(e) => list(e)} aria-label="List"><Glyph name="list.bullet" size={20} /></button>
        </div>
      </div>
      <style>{"@keyframes spb-bp-in{from{opacity:0}to{opacity:1}}"}</style>
    </div>
  );
};
