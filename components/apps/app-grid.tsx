"use client";
import Link from "next/link";
import { useState } from "react";
import { Arrow } from "@/components/ui/button";
import { FilterButton, FilterPill } from "@/components/sections/showcase";
import { FadeImg } from "./fade-img";
import { PlanChip } from "./pro-chip";

export type AppCard = {
  slug: string;
  href: string;
  name: string;
  developer: string;
  category: string;
  categoryId: string;
  icon: string;
  shots: string[];
  /** The screenshots' real proportions ("1290 / 2796"), so they show whole, never cropped. */
  aspect: string;
  pattern: string;
  patternSummary: string;
  /** Its remix opens with Pro (three apps are free). */
  pro: boolean;
};

/**
 * The library, drawn like the landing page: a quiet row of filters (all, the free ones, then the
 * categories), then one tray per app: the app as the App Store shows it (icon, name) and the remix
 * we made of it, numbered and marked Free or Pro, beside a panel of its App Store screenshots.
 */
export function AppGrid({ cards, categories }: { cards: AppCard[]; categories: Array<{ id: string; name: string; count: number }> }) {
  const [category, setCategory] = useState("all");
  const shown = category === "all" ? cards : category === "free" ? cards.filter((c) => !c.pro) : cards.filter((c) => c.categoryId === category);
  return (
    <div>
      {/* The Components page's filter bar: All on the left, the categories in a pill that scrolls. */}
      <div className="mb-12 flex items-center justify-between gap-3">
        <FilterPill>
          <FilterButton label="All" count={cards.length} tone="all" active={category === "all"} onClick={() => setCategory("all")} />
          <FilterButton label="Free" count={cards.filter((c) => !c.pro).length} active={category === "free"} onClick={() => setCategory("free")} />
        </FilterPill>
        <FilterPill scroll>
          {categories.map((c) => (
            <FilterButton key={c.id} label={c.name} count={c.count} active={category === c.id} onClick={() => setCategory(c.id)} />
          ))}
        </FilterPill>
      </div>

      {/* One app per tray: who it is and what we recreated on the left, its App Store screenshots on a
          panel across the rest (they scroll sideways when there are more than fit). The whole tray is
          the link: hovered, the screenshots rise and the remix's arrow takes the ink. */}
      <ul className="flex flex-col gap-3">
        {shown.map((c) => (
          <li key={c.slug}>
            <Link href={c.href} className="tray group grid gap-2 lg:grid-cols-[288px_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col px-3.5 pt-4 pb-3 sm:px-4 lg:pt-5 lg:pb-4">
                <div className="flex items-center gap-3">
                  <FadeImg src={c.icon} loading="lazy" width={36} height={36} className="size-9 flex-none rounded-[9px] ring-1 ring-[var(--line)]" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium tracking-[-0.01em] text-foreground">{c.name}</p>
                    <p className="truncate text-[12.5px] text-subtle">{c.category}</p>
                  </div>
                </div>
                <div className="mt-7 lg:mt-auto">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-subtle">
                    <span className="tabular-nums">{String(cards.indexOf(c) + 1).padStart(2, "0")}</span>
                    <span>Our remix</span>
                    <PlanChip pro={c.pro} className="ml-auto" />
                  </div>
                  <p className="mt-2.5 inline-flex items-center gap-2 text-[20px] leading-[1.2] font-normal tracking-[-0.025em] text-foreground">
                    {c.pattern}
                    <Arrow className="size-4 text-muted transition-colors group-hover:text-foreground" />
                  </p>
                  <p className="mt-2 text-[13.5px] leading-[21px] text-pretty text-muted">{c.patternSummary}</p>
                </div>
              </div>

              <div className="panel" aria-hidden>
                <div className="flex gap-2.5 overflow-x-auto p-3 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)]">
                  {c.shots.map((s) => (
                    <FadeImg key={s} src={s} loading="lazy" style={{ aspectRatio: c.aspect }} className="h-[260px] w-auto flex-none rounded-[12px] ring-1 ring-[var(--line)] transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:-translate-y-1 lg:h-[300px]" />
                  ))}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
