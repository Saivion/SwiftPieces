"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { BlockCard as Card } from "@/lib/block-cards";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { BlockLoop } from "./block-loop";
import { FilterButton, FilterPill } from "@/components/sections/showcase";
import { RevealGroup, RevealItem } from "@/components/effects/reveal";
import { NewBadge } from "@/components/ui/new-badge";
import { ProBadge } from "@/components/ui/pro-badge";
import { cn } from "@/lib/cn";

/**
 * A block as a card (Graphite's library card): its live preview on the square block stage, a panel inset
 * in a tray (Pro blocks play a recording of Pro's own preview, block-loop.tsx), then its category and whether
 * it is free or Pro, its name, one line on what it does, and what it is built from as outlined pills. Blocks
 * are fewer and bigger than pieces, so their cards carry their words instead of a hover label.
 */
export function BlockCard({ card, priority = false }: { card: Card; priority?: boolean }) {
  const pro = card.kind === "pro";
  return (
    <Link href={card.href} className="group relative flex h-full flex-col rounded-[26px] bg-surface p-1.5 transition-colors duration-200 hover:bg-surface-3">
      <PreviewFrame aspect="aspect-square">
        {pro && card.still && card.loop ? (
          <BlockLoop still={card.still} loop={card.loop} alt={`${card.title}, a SwiftPieces Pro block`} eager={priority} />
        ) : (
          <PiecePreview name={card.name} />
        )}
      </PreviewFrame>
      <div className="flex grow flex-col px-3.5 pt-5 pb-4 sm:px-4">
        <p className="flex items-center gap-2 text-[12.5px] text-subtle">
          <span>{card.categoryTitle} · {pro ? "Pro" : "Free"}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {card.isNew ? <NewBadge /> : null}
            {pro ? <ProBadge size="sm" /> : null}
          </span>
        </p>
        <p className="mt-2 text-[22px] leading-[1.15] font-normal tracking-[-0.025em]">{card.title}</p>
        <p className="mt-2 line-clamp-2 text-[14.5px] leading-[23px] text-pretty text-muted">{card.summary}</p>
        <div className="mt-auto pt-5">
          <p className="text-[12.5px] text-subtle">{pro ? "Inside" : "Built from"}</p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {card.parts.map((p) => (
              <span key={p.label} className="inline-flex h-[26px] items-center rounded-full border border-[var(--line-strong)] px-2.5 text-[12px] text-muted">{p.label}</span>
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
