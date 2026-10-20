import { getBlocks, getRegistryIndex } from "@/lib/registry";
import { categories } from "@/lib/categories";
import { proCatalog } from "@/lib/pro-catalog";

/** The inventory, marching past: every free category with its count, then what Pro adds. */
export function Ticker() {
  const items = getRegistryIndex();
  const cats = Object.entries(categories)
    .map(([k, c]) => ({ v: c.title, n: items.filter((i) => i.category === k).length }))
    .filter((c) => c.n > 0);
  const row = [
    ...cats.map((c) => ({ v: c.v, n: String(c.n), pro: false })),
    { v: "Blocks", n: String(getBlocks().length), pro: false },
    { v: "Pro screens", n: String(proCatalog.screens), pro: true },
    { v: "Pro blocks", n: String(proCatalog.blocks), pro: true },
    { v: "Pro flows", n: String(proCatalog.flows.total), pro: true },
    { v: "Pro app templates", n: String(proCatalog.templates), pro: true },
    { v: "Pro Build Kit", n: String(proCatalog.buildKit.total), pro: true },
  ];
  return (
    <div className="marquee-pause relative overflow-hidden py-1 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]" aria-label="Library inventory">
      <div className="marquee flex w-max gap-2 whitespace-nowrap" style={{ ["--marquee-duration" as string]: "70s" }}>
        {[...row, ...row].map((r, i) => (
          <span key={i} className="inline-flex h-9 items-center gap-2.5 rounded-full bg-surface px-[15px] text-[13.5px] text-muted">
            <span className="font-medium text-foreground">{r.v}</span>
            {r.pro ? (
              // Pro counts shimmer through the Pro palette together: one shared phase, so they read as a set.
              <span className="pro-shimmer font-semibold tabular-nums">{r.n}</span>
            ) : (
              <span className="tabular-nums">{r.n}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
