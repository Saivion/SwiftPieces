import type { CSSProperties, ReactNode } from "react";
import type { Surfaces } from "./surfaces";

/**
 * The studio's frame, shared by the live studio and the server shell that stands in for it while
 * it loads, so nothing moves when it arrives. One tray holding the canvas and the settings panel
 * with the same gap everywhere. Wide, it's exactly the window's height under the navbar, so the
 * whole studio is in view without scrolling the page. Narrow, the canvas stacks above the panel.
 * Live, the tray takes the canvas's surfaces (surfaces.ts): near-white when it shows light, near-
 * black when it shows dark, so the seams between tiles stay soft either way.
 */
export function StudioFrame({ canvas, panel, busy, surfaces }: { canvas: ReactNode; panel: ReactNode; busy?: boolean; surfaces?: Surfaces }) {
  const tone = surfaces ? ({ ["--studio-tray" as string]: surfaces.tray, ["--studio-tray-solid" as string]: surfaces.tray, borderColor: surfaces.edge } as CSSProperties) : undefined;
  return (
    <div aria-busy={busy || undefined} className="studio-tray rounded-[var(--radius-lg)] border border-[var(--card-border)] bg-[var(--studio-tray)] p-2.5 shadow-[0_40px_100px_-50px_rgb(0_0_0/.7)] transition-[background-color,border-color] duration-500 ease-[var(--ease-out)]" style={tone}>
      {/* 68px: the frame's 12px margin above, its 10px padding and 1px border top and bottom, and
          room below for the canvas's bar, which sits on the frame's bottom edge (22px past it). */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:h-[calc(100svh-var(--nav-h)-68px)] lg:max-h-[940px] lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* A phone: the canvas stays in view under the navbar's pill while the settings scroll by.
            A tablet: a fixed-height canvas over the settings. */}
        <div className="relative z-10 min-h-0 min-w-0 max-md:sticky max-md:top-[68px] max-md:h-[min(58svh,480px)] max-md:bg-[var(--studio-tray-solid)] max-md:shadow-[0_18px_24px_-18px_rgb(0_0_0/.55)] max-md:outline-8 max-md:outline-[var(--studio-tray-solid)] md:max-lg:h-[620px]">{canvas}</div>
        <div className="min-h-0 max-lg:mt-8">{panel}</div>
      </div>
    </div>
  );
}
