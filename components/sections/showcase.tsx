"use client";
import { NewBadge } from "@/components/ui/new-badge";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
            <p className="p-body mt-2 line-clamp-2 text-[13px]">{item.description}</p>
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
      <h2 className="flex items-center gap-2.5 text-[14px] font-medium text-foreground">{label}{badge ? <NewBadge /> : null}</h2>
      <span className="text-[11.5px] tabular-nums text-subtle">{count}</span>
    </div>
  );
}

/**
 * The shared pill both filter groups sit in. `scroll` lets the category group shrink and scroll;
 * the edge fade appears only while there is more to scroll to, so a pill that fits stays crisp.
 */
function FilterPill({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!scroll || !el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", check); };
  }, [scroll]);
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-0.5 rounded-[10px] bg-white/[0.04] p-1",
        scroll ? "min-w-0 overflow-x-auto [scrollbar-width:none]" : "shrink-0",
        more && "[mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)]",
      )}
    >
      {children}
    </div>
  );
}

/** One filter. Active All is the red accent, active New is Pro pink, an active category is a soft lift. */
function FilterButton({ label, count, active, tone, onClick }: { label: string; count: number; active: boolean; tone?: "all" | "new"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        active
          ? tone === "all" ? "bg-accent text-black" : tone === "new" ? "bg-[#ff8fb8] text-[#2a0714]" : "bg-white/[0.09] text-foreground"
          : tone === "new" ? "text-[#ff8fb8] hover:bg-white/[0.04]" : "text-muted hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("text-[11px] tabular-nums", active ? (tone ? "text-black/55" : "text-muted") : tone === "new" ? "text-[#ff8fb8]/60" : "text-subtle")}>{count}</span>
    </button>
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
        // Two matching pills on one row: the broad views (All, New) on the left, the categories on the
        // right. Same height, padding, radius and states on both sides, so the row reads as one
        // balanced bar. The category pill scrolls inside itself (faded at its edge) when space is short.
        <div className="mb-12 flex items-center justify-between gap-3">
          <FilterPill>
            {cats.filter((c) => c === "all" || c === "new").map((c) => (
              <FilterButton key={c} active={cat === c} tone={c === "new" ? "new" : "all"} label={c === "new" ? "New" : "All"} count={count(c)} onClick={() => setCat(c)} />
            ))}
          </FilterPill>
          <FilterPill scroll>
            {cats.filter((c) => c !== "all" && c !== "new").map((c) => (
              <FilterButton key={c} active={cat === c} label={categoryTitle(c)} count={count(c)} onClick={() => setCat(c)} />
            ))}
          </FilterPill>
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
