import type { CSSProperties, ReactNode } from "react";
import type { Surfaces } from "./surfaces";

/**
 * The settings panel's surface, shared by the live panel and the server shell: the panel colour in
 * the studio's tray (concentric with its 30px corners and 8px padding), with a hairline so it holds
 * its edge whatever paper the canvas has given the tray.
 */
export const panelSurface = "rounded-[22px] bg-surface-2 ring-1 ring-[var(--line)]";

/** A field on the panel (a setting's row, the code, a chip): a pill of the tray colour that takes a little ink on hover. */
export const field = "bg-surface transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--foreground)_7%,var(--surface))]";

/** A bar or chip floating over the canvas: the raised layer, a hairline and the float shadow, as the site's menus. */
export const floating = "bg-surface-3 shadow-[var(--shadow-float)] ring-1 ring-[var(--line-strong)]";

/**
 * The studio's frame, shared by the live studio and the server shell that stands in for it while
 * it loads, so nothing moves when it arrives. One tray (Graphite: 30px corners, 8px padding)
 * holding the canvas and the settings panel with the same gap everywhere. Wide, it's exactly the
 * window's height under the navbar, so the whole studio is in view without scrolling the page.
 * Narrow, the canvas stacks above the panel. Live, the tray takes the canvas's surfaces
 * (surfaces.ts): near-white when it shows light, near-black when it shows dark, so the seams
 * between tiles stay soft either way, with a hairline edge in the same surfaces.
 */
export function StudioFrame({ canvas, panel, busy, surfaces }: { canvas: ReactNode; panel: ReactNode; busy?: boolean; surfaces?: Surfaces }) {
  const tone = surfaces ? ({ ["--studio-tray" as string]: surfaces.tray, ["--studio-tray-solid" as string]: surfaces.tray, borderColor: surfaces.edge } as CSSProperties) : undefined;
  return (
    <div aria-busy={busy || undefined} className="studio-tray rounded-[30px] border border-[var(--line)] bg-[var(--studio-tray)] p-2 transition-[background-color,border-color] duration-500 ease-[var(--ease-out)]" style={tone}>
      {/* 64px: the frame's 12px margin above, its 8px padding and 1px border top and bottom, and
          room below for the canvas's bar, which sits on the frame's bottom edge (22px past it). */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:h-[calc(100svh-var(--nav-h)-64px)] lg:max-h-[940px] lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* A phone: the canvas stays in view under the navbar's pill while the settings scroll by.
            A tablet: a fixed-height canvas over the settings. */}
        <div className="relative z-10 min-h-0 min-w-0 max-md:sticky max-md:top-[68px] max-md:h-[min(58svh,480px)] max-md:rounded-[22px] max-md:bg-[var(--studio-tray-solid)] max-md:shadow-[0_18px_24px_-18px_rgb(0_0_0/.45)] max-md:outline-8 max-md:outline-[var(--studio-tray-solid)] md:max-lg:h-[620px]">{canvas}</div>
        <div className="min-h-0 max-lg:mt-8">{panel}</div>
      </div>
    </div>
  );
}
