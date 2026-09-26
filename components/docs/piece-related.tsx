import Link from "next/link";
import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { ShowcaseGrid } from "@/components/sections/showcase";
import { getRegistryIndex } from "@/lib/registry";
import { categories } from "@/lib/categories";
import { categoryHubPath, getHub } from "@/lib/hubs";

/**
 * The end of a piece page: its neighbours in the same category as the usual preview cards, the
 * category hub, and the guide that teaches the technique. This is the link path from every piece
 * back up to its hub and across to its siblings.
 */
export function PieceRelated({ item }: { item: RegistryIndexEntry }) {
  const all = getRegistryIndex();
  const hub = getHub(categories[item.category].slug);
  const siblings = all.filter((i) => i.category === item.category && i.name !== item.name);
  // Small categories borrow from their related hubs' categories, so there are always three cards.
  const extra = hub?.related.map(getHub).flatMap((h) => (h?.category ? all.filter((i) => i.category === h.category) : [])) ?? [];
  const picks = [...siblings, ...extra.filter((i) => i.name !== item.name && !siblings.includes(i))].slice(0, 3);
  const name = hub?.name ?? categories[item.category].title;
  return (
    <section className="not-prose mt-16" aria-labelledby="related-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="related-heading" className="t-h3">More SwiftUI {name.toLowerCase()}</h2>
        <Link href={categoryHubPath(item.category)} className="u-link text-[13px] font-semibold text-foreground">
          All {name.toLowerCase()} →
        </Link>
      </div>
      <div className="mt-5">
        <ShowcaseGrid items={picks} filters={false} narrow />
      </div>
      {hub?.guides.length ? (
        <p className="mt-6 text-[12.5px] text-muted">
          Build it yourself:{" "}
          {hub.guides.map(([label, href], i) => (
            <span key={href}>
              {i ? " · " : ""}
              <Link href={href} className="u-link text-foreground">{label}</Link>
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}
