"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { BlockCard as Card } from "@/lib/block-cards";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { FilterButton, FilterPill } from "@/components/sections/showcase";
import { RevealGroup, RevealItem } from "@/components/effects/reveal";
import { NewBadge } from "@/components/ui/new-badge";
import { cn } from "@/lib/cn";

/**
 * A block as a card: its live preview on the square block stage (Pro blocks show a still of Pro's own preview),
 * then its category and whether it is free or Pro, its name, one line on what it does, and what it is built from.
 * Blocks are fewer and bigger than pieces, so their cards carry their words instead of a hover label.
 */
export function BlockCard({ card, priority = false }: { card: Card; priority?: boolean }) {
  const pro = card.kind === "pro";
  return (
    <Link href={card.href} className="card card-hover group relative flex h-full flex-col overflow-hidden">
      <PreviewFrame aspect="aspect-square" className="rounded-none">
        {pro && card.still ? (
          // eslint-disable-next-line @next/next/no-img-element -- a static still; next/image would re-encode it per width for no gain
          <img src={card.still} alt={`${card.title}, a SwiftPieces Pro block`} loading={priority ? "eager" : "lazy"} decoding="async" className="absolute inset-0 size-full object-cover" />
        ) : (
          <PiecePreview name={card.name} />
        )}
      </PreviewFrame>
      {card.isNew ? <NewBadge solid className="absolute top-3 left-3 z-10" /> : null}
      {pro ? <span className="absolute top-3 right-3 z-10 inline-flex h-[18px] items-center rounded-[5px] bg-black/60 px-1.5 text-[10px] leading-none font-semibold text-white backdrop-blur-sm">Pro</span> : null}
      <div className="flex grow flex-col border-t border-[var(--card-border)] p-5 sm:p-6">
        <p className="p-meta text-subtle">{card.categoryTitle} · {pro ? "Pro" : "Free"}</p>
        <p className="p-item mt-2">{card.title}</p>
        <p className="p-body mt-2 line-clamp-2 text-[13px]">{card.summary}</p>
        <div className="mt-auto pt-5">
          <p className="text-[11px] text-subtle">{pro ? "Inside" : "Built from"}</p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {card.parts.map((p) => (
              <span key={p.label} className="inline-flex h-[22px] items-center rounded-[6px] bg-foreground/[0.05] px-2 text-[11.5px] font-medium text-muted">{p.label}</span>
            ))}
          </p>
        </div>
      </div>
    </Link>
  );
}

/**
 * Every block, free and Pro, with the category filters the components grid has. `filters={false}` and `limit` make
 * it the "more blocks" strip at the foot of a block's page.
 */
export function BlockGrid({ cards, filters = true, limit, narrow }: { cards: Card[]; filters?: boolean; limit?: number; narrow?: boolean }) {
  const [cat, setCat] = useState("all");
  const cats = useMemo(() => Array.from(new Map(cards.map((c) => [c.category, c.categoryTitle])).entries()), [cards]);
  const shown = useMemo(() => {
    const f = cat === "all" ? cards : cat === "pro" ? cards.filter((c) => c.kind === "pro") : cards.filter((c) => c.category === cat);
    return limit ? f.slice(0, limit) : f;
  }, [cards, cat, limit]);
  const proCount = cards.filter((c) => c.kind === "pro").length;
  return (
    <div>
      {filters ? (
        <div className="mb-10 flex items-center justify-between gap-3">
          <FilterPill>
            <FilterButton active={cat === "all"} tone="all" label="All" count={cards.length} onClick={() => setCat("all")} />
            {proCount ? <FilterButton active={cat === "pro"} label="Pro" count={proCount} onClick={() => setCat("pro")} /> : null}
          </FilterPill>
          <FilterPill scroll>
            {cats.map(([id, title]) => (
              <FilterButton key={id} active={cat === id} label={title} count={cards.filter((c) => c.category === id).length} onClick={() => setCat(id)} />
            ))}
          </FilterPill>
        </div>
      ) : null}
      <RevealGroup key={cat} className={cn("grid gap-4 sm:grid-cols-2", narrow ? "xl:grid-cols-3" : "lg:grid-cols-3")} stagger={0.05}>
        {shown.map((card, i) => (
          <RevealItem key={card.name} className="h-full">
            <BlockCard card={card} priority={i < 3} />
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}
