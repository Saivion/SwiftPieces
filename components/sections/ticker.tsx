import { getRegistryIndex } from "@/lib/registry";
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
    { v: "Pro screens", n: String(proCatalog.screens), pro: true },
    { v: "Pro app templates", n: String(proCatalog.templates), pro: true },
    { v: "Pro Build Kit", n: String(proCatalog.buildKit.total), pro: true },
  ];
  return (
    <div className="relative border-t border-[var(--line)]">
      <div className="marquee-pause relative overflow-hidden py-5 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]" aria-label="Library inventory">
        <div className="marquee flex w-max gap-10 whitespace-nowrap" style={{ ["--marquee-duration" as string]: "45s" }}>
          {[...row, ...row].map((r, i) => (
            <span key={i} className="t-meta inline-flex items-center gap-3 text-muted">
              <span className="text-foreground">{r.v}</span>
              <span className={r.pro ? "text-subtle" : "text-accent"}>{r.n}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
