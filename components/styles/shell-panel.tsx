"use client";
// The settings panel as the server draws it, while the live studio loads: the live panel itself
// (studio-panel.tsx), held on the SwiftPieces look and inert, so the sidebar the page opens with is
// the one that stays. Every setting's menu is in the page with all its choices, for crawlers too.
import { encodeStyle, themeFromLook } from "@swiftpieces/builder";
import type { StyleApp } from "./studio-actions";
import { StudioPanel } from "./studio-panel";
import type { Studio } from "./studio-state";

const theme = themeFromLook("pieces");
const none = () => {};

/** A studio that never changes: the first style a plain visit opens with. */
const still: Studio = {
  theme,
  code: encodeStyle(theme),
  mood: null,
  locks: new Set(),
  pick: "any",
  setPick: none,
  canBack: false,
  canForward: false,
  edit: none,
  apply: none,
  shuffle: none,
  toggleLock: none,
  back: none,
  forward: none,
  paste: () => false,
};

export function ShellPanel({ apps }: { apps: StyleApp[] }) {
  return (
    <div inert className="flex min-h-0 flex-col lg:h-full">
      <StudioPanel studio={still} apps={apps} preferred={null} onNotice={none} onSpot={none} />
    </div>
  );
}
