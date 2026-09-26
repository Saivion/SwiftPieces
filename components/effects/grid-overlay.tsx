import { cn } from "@/lib/cn";
/** Faint column guides behind a block so content visibly aligns to the grid. */
export function GridOverlay({ columns = 12, className }: { columns?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 mx-auto hidden w-full max-w-[var(--container)] px-5 sm:px-8 lg:block lg:px-14 2xl:px-20", className)}>
      <div className="grid h-full gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => <div key={i} className="h-full border-l border-line/60 last:border-r" />)}
      </div>
    </div>
  );
}
