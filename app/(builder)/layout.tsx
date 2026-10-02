import "@swiftpieces/builder/builder.css";
import type { ReactNode } from "react";

/**
 * The Playground reads like the docs but draws its own bar: a top panel with back, the mark, the
 * breadcrumb, Interact / Inspect and the build actions; one glass panel on the left (the app, its
 * screens, style and the inspector as tabs) and the stage beside it (packages/builder, layout
 * "docked"). Its stylesheet loads here, on these routes only, so the server-rendered shell paints
 * in its final layout.
 */
export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return <main className="relative flex-1">{children}</main>;
}
