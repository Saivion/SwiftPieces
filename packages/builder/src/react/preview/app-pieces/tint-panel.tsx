"use client";
import type { CSSProperties } from "react";
import { GLOWS, PANELS, THEME_FILLS } from "../../../definitions/app-pieces/tint-panel.js";
import { Frame, SchemeContext, alignItems, n, s, type Renderer, accentize } from "../env.js";
import { WideRoot } from "./data-kit.js";
import { injectStyle } from "../primitives.js";
import { EASE_OUT } from "./entrance.js";

// The contents settle in from 0.95 with a fade when the panel appears, like TintPanelEntrance in
// the export; a plain fade under Reduce Motion.
injectStyle(
  "spa-tint-panel",
  `.spa-tp>*{animation:spa-enter .28s ${EASE_OUT} backwards}
@media (prefers-reduced-motion: reduce){.spa-tp>*{animation:spa-fade .2s linear backwards}}`,
);

/** The dark system colours, so everything inside reads white on a colour field (`.colorScheme(.dark)`). */
const DARK: CSSProperties = {
  ["--ios-label" as string]: "#fff",
  ["--ios-label2" as string]: "rgb(235 235 245 / .64)",
  ["--ios-label3" as string]: "rgb(235 235 245 / .32)",
  ["--ios-fill" as string]: "rgb(255 255 255 / .12)",
  ["--ios-fill2" as string]: "rgb(255 255 255 / .18)",
  ["--ios-fill4" as string]: "rgb(255 255 255 / .08)",
  ["--ios-sep" as string]: "rgb(255 255 255 / .16)",
  ["--h-text" as string]: "#F4F3EF",
  ["--h-muted" as string]: "#C9C6C0",
  color: "#fff",
  colorScheme: "dark",
};

export const TintPanel: Renderer = (r) => {
  const fillId = s(r.p, "fill") || "navy";
  const theme = accentize(THEME_FILLS[fillId]);
  const panel = PANELS[fillId] ?? PANELS.navy;
  const glow = accentize(GLOWS[s(r.p, "glow")]);
  const ground = theme ? theme[r.scheme === "dark" ? 0 : 1] : r.p.fade === false ? panel.top : `linear-gradient(180deg, ${panel.top}, ${panel.bottom})`;
  const glowAlpha = theme && r.scheme === "light" ? "1F" : "38";
  const sp = (v: number) => `calc(${v}px * var(--spb-space, 1))`;
  const body = <Frame axis="v">{r.children}</Frame>;
  return (
    <WideRoot
      r={r}
      className={`${r.box.className} spb-vflow spa-tp`}
      style={{
        ...(theme ? {} : DARK),
        display: "flex", flexDirection: "column", alignItems: alignItems(s(r.p, "alignment") || "leading"),
        gap: sp(n(r.p, "spacing")), padding: sp(n(r.p, "padding")), minHeight: n(r.p, "minHeight") || undefined,
        borderRadius: `calc(${n(r.p, "radius")}px * var(--spb-corner, 1))`, boxSizing: "border-box",
        background: glow ? `radial-gradient(120% 460px at 50% 0%, ${glow}${glowAlpha}, transparent 100%), ${ground}` : ground,
      }}
    >
      {theme ? body : <SchemeContext.Provider value="dark">{body}</SchemeContext.Provider>}
    </WideRoot>
  );
};
