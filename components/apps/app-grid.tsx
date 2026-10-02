"use client";
import Link from "next/link";
import { useState } from "react";
import { Arrow } from "@/components/ui/button";
import { Index } from "@/components/ui/panel";
import { CornerTicks } from "@/components/sections/feature-row";
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
 * categories), then one hairline list, one app per row: the app as the App Store shows it (icon,
 * name, its screenshots), and the remix we made of it, numbered in red like every other list on the
 * site and marked Free or Pro.
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

      {/* One app per row: who it is and what we recreated on the left, its App Store screenshots
          running across the rest of the row (they scroll sideways when there are more than fit). */}
      <ul>
        {shown.map((c, i) => (
          <li key={c.slug} className="frame-cell [--grid-line:var(--card-border)]">
            <CornerTicks corners={i === 0 ? ["tl", "tr", "bl", "br"] : ["bl", "br"]} />
            <Link href={c.href} className="group grid gap-6 p-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:p-7">
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-2.5">
                  <FadeImg src={c.icon} loading="lazy" width={28} height={28} className="size-7 flex-none rounded-[7px] ring-1 ring-[var(--grid-line)]" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground transition-colors">{c.name}</p>
                    <p className="truncate text-[11px] text-subtle">{c.category}</p>
                  </div>
                </div>
                <div className="mt-6 lg:mt-auto">
                  <div className="flex items-center gap-2">
                    <Index n={cards.indexOf(c) + 1} />
                    <span className="text-[10.5px] font-medium tracking-[0.08em] text-subtle uppercase">Our remix</span>
                    <PlanChip pro={c.pro} className="ml-auto" />
                  </div>
                  <p className="mt-2 inline-flex items-center gap-2 text-[13px] font-medium text-foreground">
                    {c.pattern}
                    <Arrow motion className="size-3.5 text-subtle transition-colors group-hover:text-foreground" />
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">{c.patternSummary}</p>
                </div>
              </div>

              <div className="-mx-5 -my-1 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)] lg:mx-0 lg:px-0" aria-hidden>
                {c.shots.map((s) => (
                  <FadeImg key={s} src={s} loading="lazy" style={{ aspectRatio: c.aspect }} className="h-[260px] w-auto flex-none rounded-[6px] ring-1 ring-[var(--grid-line)] transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:-translate-y-1 lg:h-[300px]" />
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
