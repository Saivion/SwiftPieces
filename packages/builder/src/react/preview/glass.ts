// Liquid Glass in the web preview, the way iOS 26 draws a glass control (the Swift uses
// `glassEffect`, definitions/shared.ts GLASS_BUTTON_SWIFT): a see-through frost over whatever is
// behind, a bright hairline edge catching the light at the top, and a soft lift off the screen.
import type { CSSProperties } from "react";
import type { Scheme } from "./env.js";

export function glassSurface(scheme: Scheme): CSSProperties {
  const dark = scheme === "dark";
  return {
    background: dark ? "rgba(255,255,255,.11)" : "rgba(255,255,255,.66)",
    backdropFilter: "blur(14px) saturate(1.8)",
    WebkitBackdropFilter: "blur(14px) saturate(1.8)",
    boxShadow: dark
      ? "inset 0 .5px 0 rgba(255,255,255,.30), inset 0 0 0 .5px rgba(255,255,255,.14), 0 6px 18px rgba(0,0,0,.30)"
      : "inset 0 .5px 0 rgba(255,255,255,.95), inset 0 0 0 .5px rgba(0,0,0,.07), 0 6px 18px rgba(0,0,0,.10)",
  };
}
