"use client";
import { NewBadge } from "@/components/ui/new-badge";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { RevealGroup, RevealItem } from "@/components/effects/reveal";
import { Panel, PanelBody, PanelMedia, Index } from "@/components/ui/panel";
import { piecePath } from "@/lib/registry-paths";
import { cn } from "@/lib/cn";
import { categoryTitle } from "@/lib/categories";

export function ComponentCard({ item, index }: { item: RegistryIndexEntry; index?: number }) {
  return (
    <RevealItem>
      <Link href={piecePath(item)} className="group block h-full">
        <Panel hover className="h-full">
          <PanelMedia>
            <PreviewFrame tone={item.category === "backgrounds" ? "black" : "dark"}>
              <PiecePreview name={item.name} />
            </PreviewFrame>
          </PanelMedia>
          <PanelBody>
            <div className="flex items-center justify-between gap-3">
              <p className="p-item min-w-0 truncate">{item.title}</p>
              {item.isNew ? <NewBadge /> : null}
            </div>
            <p className="p-body mt-2 line-clamp-2 text-[13.5px]">{item.description}</p>
          </PanelBody>
        </Panel>
      </Link>
    </RevealItem>
  );
}

function CardGrid({ items }: { items: RegistryIndexEntry[] }) {
  return (
    <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" stagger={0.04}>
      {items.map((item, i) => (
        <ComponentCard key={item.name} item={item} index={i} />
      ))}
    </RevealGroup>
  );
}

function GroupHeading({ label, count, badge, className }: { label: string; count: number; badge?: boolean; className?: string }) {
  return (
    <div className={cn("mb-6 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4", className)}>
      <h2 className="flex items-center gap-2.5 text-[15px] font-medium text-foreground">{label}{badge ? <NewBadge /> : null}</h2>
      <span className="text-[12px] tabular-nums text-subtle">{count}</span>
    </div>
  );
}

export function ShowcaseGrid({ items, filters = true, limit }: { items: RegistryIndexEntry[]; filters?: boolean; limit?: number }) {
  const [cat, setCat] = useState<string>("all");
  const fresh = useMemo(() => items.filter((i) => i.isNew), [items]);
  // "New" sits right after "All" while anything is new; it disappears with the last badge.
  const cats = useMemo(() => ["all", ...(fresh.length ? ["new"] : []), ...Array.from(new Set(items.map((i) => i.category)))], [items, fresh]);
  const count = (c: string) => (c === "all" ? items.length : c === "new" ? fresh.length : items.filter((i) => i.category === c).length);
  const shown = useMemo(() => {
    const f = cat === "all" ? items : cat === "new" ? fresh : items.filter((i) => i.category === cat);
    return limit ? f.slice(0, limit) : f;
  }, [cat, items, fresh, limit]);
  const split = filters && !limit && cat === "all" && fresh.length > 0;
  const rest = useMemo(() => items.filter((i) => !i.isNew), [items]);

  return (
    <div>
      {filters ? (
        // Phones scroll one row (faded at the edge); wider screens wrap, so no category is ever cut off.
        <div className="-mx-5 mb-12 flex gap-1.5 overflow-x-auto px-5 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none]">
          {cats.map((c) => {
            const active = cat === c;
            const isNewChip = c === "new";
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={cn(
                  "relative h-9 shrink-0 rounded-[10px] px-3.5 text-sm font-medium transition-colors",
                  active
                    ? isNewChip ? "bg-[#ff8fb8] text-[#2a0714]" : "bg-accent text-black"
                    : isNewChip ? "bg-[#ff8fb8]/10 text-[#ff8fb8] hover:bg-[#ff8fb8]/15" : "bg-white/[0.03] text-muted hover:bg-white/[0.06] hover:text-foreground",
                )}
              >
                {c === "all" ? "All" : isNewChip ? "New" : categoryTitle(c)}
                <span className={cn("ml-1.5 text-[11px]", active ? "text-black/60" : isNewChip ? "text-[#ff8fb8]/70" : "text-subtle")}>{count(c)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {/* On "All", new pieces get their own group on top and are left out of the grid below, so they
          are never mixed in with the rest. Every other tab is one grid. */}
      {split ? (
        <>
          <GroupHeading label="Just added" count={fresh.length} badge />
          <CardGrid key={`${cat}-new`} items={fresh} />
          <GroupHeading label="All components" count={rest.length} className="mt-20 sm:mt-28" />
          <CardGrid key={`${cat}-rest`} items={rest} />
        </>
      ) : (
        <CardGrid key={cat} items={shown} />
      )}
    </div>
  );
}
