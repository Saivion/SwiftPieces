"use client";
// Style's fonts on the web: the real family where the viewer has it (every Mac ships the iOS
// families), else a close free web font. The stand-ins' stylesheet loads only when a font is used.
import { useEffect } from "react";
import { webFontsHref } from "../../core/fonts.js";
import type { ResolvedTheme } from "../../core/looks.js";

/** Adds a stylesheet link once (by its URL). */
export function loadFontsHref(href: string | null) {
  if (!href || typeof document === "undefined") return;
  if (document.head.querySelector(`link[data-spp-font="${CSS.escape(href)}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.sppFont = href;
  document.head.append(link);
}

/** Loads the stand-ins for a theme's body and heading fonts (the system default needs none). */
export function useStyleFonts(theme: ResolvedTheme | null) {
  const ids = theme ? [theme.body.id, theme.heading.id].filter((id) => id !== "default") : [];
  const key = ids.join(",");
  useEffect(() => {
    if (key) loadFontsHref(webFontsHref(key.split(",")));
  }, [key]);
}
