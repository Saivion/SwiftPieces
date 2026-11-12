import type { ReactNode } from "react";

/**
 * Styles draws the whole window itself, like an editor: no site navbar, announcement or footer.
 * The studio's sidebar carries the mark and the way back to the site (components/styles/studio-bar.tsx).
 * Exactly one window tall, so the page never scrolls; only the settings scroll, inside their panel.
 */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return <main className="relative h-dvh overflow-hidden">{children}</main>;
}
