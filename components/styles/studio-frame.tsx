import type { CSSProperties, ReactNode } from "react";
import type { Surfaces } from "./surfaces";
import { StudioBar } from "./studio-bar";

/** A field on the panel (a setting's row, the code, a chip): a pill of the tray colour that takes a little ink on hover. */
export const field = "bg-surface transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--foreground)_7%,var(--surface))]";

/** A bar or chip floating over the canvas: the raised layer, a hairline and the float shadow, as the site's menus. */
export const floating = "bg-surface-3 shadow-[var(--shadow-float)] ring-1 ring-[var(--line-strong)]";

/**
 * The studio's frame, shared by the live studio and the server shell that stands in for it while
 * it loads, so nothing moves when it arrives. The whole window, with no site navbar: from lg up the
 * settings are a rounded panel docked on the left, its top carrying the mark and the way back to the
 * site (StudioBar), and the canvas fills the right under its bar, the same 12px around and between
 * them. Below lg it is still
 * one window: the canvas on top, the settings in a sheet under it that scrolls as one (title,
 * Shuffle and every setting), with the style's code and actions held at its foot. Live, the ground
 * takes the drawn style's surfaces (surfaces.ts): near-white when it shows light, near-black when it
 * shows dark, so the seams between tiles stay soft either way.
 */
export function StudioFrame({ canvas, panel, busy, surfaces }: { canvas: ReactNode; panel: ReactNode; busy?: boolean; surfaces?: Surfaces }) {
  const tone = surfaces ? ({ ["--studio-tray" as string]: surfaces.tray } as CSSProperties) : undefined;
  return (
    <div
      aria-busy={busy || undefined}
      className="studio-tray grid size-full grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,54fr)_minmax(0,46fr)] bg-[var(--studio-tray)] transition-[background-color] duration-500 ease-[var(--ease-out)] lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-3 lg:p-3 xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]"
      style={tone}
    >
      {/* The canvas, with room above it for its bar (Components or Screens, light or dark). */}
      <div className="relative min-h-0 min-w-0 p-2 pt-[60px] lg:order-2 lg:p-0 lg:pt-[52px]">{canvas}</div>
      <aside aria-label="Style settings" className="flex min-h-0 flex-col bg-surface-2 ring-1 ring-[var(--line)] max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-t-[22px] lg:order-1 lg:rounded-[22px]">
        <StudioBar />
        <div className="min-h-0 flex-1 max-lg:flex-none">{panel}</div>
      </aside>
    </div>
  );
}
