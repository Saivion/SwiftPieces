import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The two shapes listing sections are built from (Graphite), so a page reads as one system instead
 * of a stack of one-off layouts.
 *
 * `Panel` is a library card: a tray one step off the ground with soft corners, its media on a panel
 * inset by the tray's padding, its words under that. With `hover` it lifts to the raised surface.
 * `Divided` is a run of tiles for facts, numbers and steps: each `Cell` its own tile on the tray
 * colour, set apart by a gap rather than a line.
 */
export function Panel({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn("relative flex flex-col overflow-hidden rounded-[26px] bg-surface p-1.5", hover && "transition-colors duration-200 hover:bg-surface-3", className)}>
      {children}
    </div>
  );
}

/** The media half of a panel: the inner panel, its corners following the tray's. */
export function PanelMedia({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-[20px] bg-surface-2", className)}>{children}</div>;
}

/** The text half of a panel. `grow` keeps captions bottom-aligned across a row of panels. */
export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex grow flex-col px-4 pt-5 pb-4", className)}>{children}</div>;
}

export function Divided({ children, className, cols = "sm:grid-cols-2 lg:grid-cols-4" }: { children: ReactNode; className?: string; cols?: string }) {
  return <div className={cn("grid gap-2 sm:gap-3", cols, className)}>{children}</div>;
}

/** One tile of a `Divided` run. `raised` lifts it onto the panel colour with a hairline, to mark the current one. */
export function Cell({ children, className, raised = false }: { children: ReactNode; className?: string; raised?: boolean }) {
  return <div className={cn("flex flex-col rounded-[22px] px-6 pt-[26px] pb-7", raised ? "bg-surface-2 ring-1 ring-[var(--line-strong)] ring-inset" : "bg-surface", className)}>{children}</div>;
}

/** The quiet two-digit index tiles and cards are numbered with. */
export function Index({ n }: { n: string | number }) {
  return <p className="text-[13px] font-medium text-subtle tabular-nums">{typeof n === "number" ? String(n).padStart(2, "0") : n}</p>;
}
