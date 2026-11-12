import { ShellPanel } from "./shell-panel";
import type { StyleApp } from "./studio-actions";
import { StudioFrame } from "./studio-frame";

/** The bento canvas's cards (components/styles/bento), as quiet placeholders in the same grid. */
const CARDS = ["player", "seg", "code", "week", "type", "heat", "toggle", "react", "chart", "chat", "tasks", "rings", "sliders", "timer", "units", "swatch", "status", "pricing", "pay"];

/**
 * The studio as the server draws it, while the live one loads: the same frame and grid, and the
 * live settings panel itself on the SwiftPieces look (shell-panel.tsx), so the sidebar doesn't
 * change when the studio arrives. Every setting's menu carries its choices (crawlers and
 * no-JavaScript visitors read what a style is made of). The tiles are quiet placeholders. Nothing
 * here is interactive.
 */
export function StudioShell({ apps }: { apps: StyleApp[] }) {
  return (
    <StudioFrame
      busy
      canvas={
        <div className="bento-host size-full">
          <div className="bento-grid size-full">
            {CARDS.map((id) => (
              <div key={id} data-card={id} className="min-h-0 animate-pulse rounded-[22px] bg-foreground/[.04]" />
            ))}
          </div>
        </div>
      }
      panel={<ShellPanel apps={apps} />}
    />
  );
}

