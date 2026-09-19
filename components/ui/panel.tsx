import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The two shapes every landing section is built from, so the page reads as one system instead of
 * a stack of one-off layouts.
 *
 * `Panel` is the black card: one hairline border, one radius, content clipped to it.
 * `Divided` is a run of cells separated by hairlines — the strip used for facts, numbers and API
 * lists. It sits on the line colour and lets each cell paint the page ground over it, so the
 * dividers are exactly 1px at any zoom.
 */
export function Panel({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn("card relative flex flex-col overflow-hidden", hover && "card-hover", className)}>
      {children}
    </div>
  );
}

/** The media half of a panel: fixed aspect, hairline under it, black ground. */
export function PanelMedia({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative border-b border-[var(--card-border)] bg-black", className)}>{children}</div>;
}

/** The text half of a panel. `grow` keeps captions bottom-aligned across a row of panels. */
export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex grow flex-col p-6", className)}>{children}</div>;
}

export function Divided({ children, className, cols = "sm:grid-cols-2 lg:grid-cols-4" }: { children: ReactNode; className?: string; cols?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--card-border)] bg-[var(--card-border)]", cols, className)}>
      {children}
    </div>
  );
}

/** One cell of a `Divided` strip. */
export function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col bg-background p-6 lg:p-7", className)}>{children}</div>;
}

/** The small red index every cell and panel is numbered with. */
export function Index({ n }: { n: string | number }) {
  return <p className="p-meta text-accent">{typeof n === "number" ? String(n).padStart(2, "0") : n}</p>;
}
