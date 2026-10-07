"use client";
// The Styles studio, live: one style, the canvas that shows it and the panel that makes it. Browser
// only (it reads the address and this browser's last style), loaded as its own chunk behind the
// server shell (style-studio-loader.tsx).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fontIds, resolveTheme, webFontsHref } from "@swiftpieces/builder";
import { loadFontsHref, useStyleFonts } from "@swiftpieces/builder/react";
import type { StyleScreen } from "@/lib/styles";
import type { Spot } from "./follows";
import type { StyleApp } from "./studio-actions";
import { StudioCanvas, useDrawn, type CanvasTiles, type CanvasView, type Scheme } from "./studio-canvas";
import { StudioFrame } from "./studio-frame";
import { StudioPanel } from "./studio-panel";
import { initialStyle, useStudio } from "./studio-state";
import { canvasSurfaces } from "./surfaces";

export type StyleStudioProps = { tiles: CanvasTiles; screens: StyleScreen[]; apps: StyleApp[]; onReady?: () => void };

export default function StyleStudio({ tiles, screens, apps, onReady }: StyleStudioProps) {
  const [first] = useState(initialStyle);
  const studio = useStudio(first.theme);
  // The canvas starts in the site's own mode; a style fixed to one mode shows in that one.
  const [scheme, setScheme] = useState<Scheme>(() => (document.documentElement.classList.contains("light") ? "light" : "dark"));
  const [view, setView] = useState<CanvasView>("components");
  // The setting the panel is pointing at (hovered or focused), which the canvas lights up.
  const [spot, setSpot] = useState<Spot | null>(null);
  // Opened from an app's Playground (its palette button): that app leads "Open in the Playground".
  const [preferred] = useState(() => new URLSearchParams(window.location.search).get("app"));

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef(0);
  const notify = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
  }, []);

  useEffect(() => {
    onReady?.();
    if (first.refused) notify("That style code couldn't be read, so here's your last style.");
  }, [onReady, first.refused, notify]);

  // Every font menu shows its fonts in themselves: the stand-ins for all of them, "Aa" glyphs only.
  useEffect(() => loadFontsHref(webFontsHref(fontIds.filter((id) => id !== "default"), "Aa")), []);
  // The style's own fonts, whole (the stand-ins for devices without them), loading as soon as a new
  // style arrives, while the canvas dips out of the old one.
  const resolved = useMemo(() => resolveTheme(studio.theme), [studio.theme]);
  useStyleFonts(resolved);

  // S shuffles (outside text fields), as in the Playground.
  const { shuffle, theme, apply, edit } = studio;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "s" && e.key !== "S") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, dialog, [contenteditable='true']")) return;
      e.preventDefault();
      shuffle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shuffle]);

  // Light or dark: a style that follows the phone just changes the canvas; one fixed to a mode
  // changes its mode, keeping its name, as the Playground's top bar does.
  const onScheme = useCallback(
    (s: Scheme) => {
      setScheme(s);
      if (theme.appearance !== "system" && theme.appearance !== s) apply({ ...theme, appearance: s });
    },
    [theme, apply],
  );

  // The style the canvas draws: a new one waits while the tiles dip out, then swaps in (useDrawn).
  // The frame wears the drawn style's surfaces too, so it changes with the tiles, never ahead of
  // them (a shuffle from dark to light would otherwise light the frame around still-dark tiles).
  const canvasRoot = useRef<HTMLDivElement>(null);
  const { drawn, leaving } = useDrawn(theme, canvasRoot);
  const shown: Scheme = drawn.appearance === "system" ? scheme : drawn.appearance;
  const surfaces = useMemo(() => canvasSurfaces(drawn, shown), [drawn, shown]);

  return (
    <>
      <StudioFrame
        surfaces={surfaces}
        canvas={<StudioCanvas theme={theme} drawn={drawn} leaving={leaving} root={canvasRoot} scheme={scheme} onScheme={onScheme} onEdit={edit} view={view} onView={setView} spot={spot} tiles={tiles} screens={screens} />}
        panel={<StudioPanel studio={studio} apps={apps} preferred={preferred} onNotice={notify} onSpot={setSpot} />}
      />
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        {notice ? <p className="sp-enter rounded-[var(--radius)] bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background shadow-[0_20px_40px_-12px_rgb(0_0_0/.5)]">{notice}</p> : null}
      </div>
    </>
  );
}
