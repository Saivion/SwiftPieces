"use client";
import { NewBadge } from "@/components/ui/new-badge";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { RevealGroup, RevealItem } from "@/components/effects/reveal";
import { piecePath } from "@/lib/registry-paths";
import { cn } from "@/lib/cn";
import { categoryTitle } from "@/lib/categories";

/**
 * Tile shapes for the masonry grid, none wider than the 4:3 stage the pieces are drawn on. A piece
 * keeps its shape across filters and pages because it is picked from its name. In the single phone
 * column every tile is 4:3, since there is nothing to stagger against.
 */
const SHAPES = [
  { aspect: "aspect-[4/3]", ratio: 4 / 3 },
  { aspect: "aspect-[4/3] sm:aspect-square", ratio: 1 },
  { aspect: "aspect-[4/3] sm:aspect-[4/5]", ratio: 4 / 5 },
  { aspect: "aspect-[4/3] sm:aspect-[3/4]", ratio: 3 / 4 },
] as const;
const SHAPE_MIX = [0, 0, 1, 1, 2, 3];

/** Glass pieces paint their own wallpaper edge to edge on the 4:3 stage, so they keep it exactly. */
function shapeOf({ name, category }: RegistryIndexEntry) {
  if (category === "glass") return SHAPES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SHAPES[SHAPE_MIX[h % SHAPE_MIX.length]];
}

type Spot = { left: number; top: number; width: number };

/**
 * Lays tiles out as masonry: each one drops into the shortest column. Heights come from the known
 * shapes, so nothing is measured but the container. The column count and gap are read from the
 * grid's own responsive classes, so the breakpoints live in one place. Until this runs (server
 * render, first paint) the same tiles sit in that plain grid, so there is never an empty frame.
 */
function useMasonry(ratios: number[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ height: number; spots: Spot[] } | null>(null);
  const key = ratios.join();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = "";
    const place = () => {
      const css = getComputedStyle(el);
      const cols = Math.max(1, css.gridTemplateColumns.split(" ").filter(Boolean).length);
      const gap = parseFloat(css.columnGap) || 0;
      const width = el.clientWidth;
      const sig = `${cols}:${width}`;
      if (sig === last) return;
      last = sig;
      const colW = (width - gap * (cols - 1)) / cols;
      const heights = new Array<number>(cols).fill(0);
      const spots = ratios.map((r) => {
        const c = heights.indexOf(Math.min(...heights));
        const spot = { left: c * (colW + gap), top: heights[c], width: colW };
        heights[c] += colW / (cols === 1 ? SHAPES[0].ratio : r) + gap;
        return spot;
      });
      setLayout({ height: Math.max(0, Math.max(...heights) - gap), spots });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
    // `key` stands in for `ratios`, which is a new array on every render.
  }, [key]);
  return { ref, layout };
}

/**
 * One tile: just the live preview. The name is the link's accessible label and shows on hover or
 * keyboard focus; on touch screens, which cannot hover, it is always shown. New stays pinned.
 */
export function ComponentCard({ item, style }: { item: RegistryIndexEntry; style?: CSSProperties }) {
  const shape = shapeOf(item);
  // Backgrounds are full-bleed and fill any shape; a 4:3 tile is already the stage's own shape.
  const fill = item.category === "backgrounds" || shape === SHAPES[0];
  return (
    <RevealItem style={style}>
      <Link href={piecePath(item)} aria-label={item.title} className="card card-hover group relative block overflow-hidden">
        <PreviewFrame aspect={shape.aspect} tone={item.category === "backgrounds" ? "black" : "dark"} className="rounded-none">
          {fill ? (
            <PiecePreview name={item.name} />
          ) : (
            // Pieces are composed on a 4:3 stage, so they keep one, centred in the tile on the same ground.
            <div className="absolute inset-x-0 top-[calc(50%-37.5cqw)] aspect-[4/3] [container-type:size]">
              <PiecePreview name={item.name} />
            </div>
          )}
        </PreviewFrame>
        {item.isNew ? (
          <NewBadge solid className="absolute top-3 left-3 z-10" />
        ) : null}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-3 left-3 z-10 max-w-[calc(100%-24px)] truncate rounded-[5px] bg-black/75 px-2 py-1 text-[12px] font-medium text-white backdrop-blur-md",
            "translate-y-1 opacity-0 transition duration-300 ease-[var(--ease-out)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
            "[@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100",
          )}
        >
          {item.title}
        </span>
      </Link>
    </RevealItem>
  );
}

function CardGrid({ items, narrow }: { items: RegistryIndexEntry[]; narrow?: boolean }) {
  const { ref, layout } = useMasonry(items.map((i) => shapeOf(i).ratio));
  return (
    <div ref={ref} className={cn("relative grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3", !narrow && "xl:grid-cols-4")} style={layout ? { height: layout.height } : undefined}>
      {/* `contents` makes the tiles the grid's own items, so the reveal group adds no box of its own. */}
      <RevealGroup className="contents" stagger={0.04}>
        {items.map((item, i) => {
          const spot = layout?.spots[i];
          return <ComponentCard key={item.name} item={item} style={spot ? { position: "absolute", left: spot.left, top: spot.top, width: spot.width } : undefined} />;
        })}
      </RevealGroup>
    </div>
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
export function FilterPill({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
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

/**
 * One filter. Active All is the red accent, active New is the New badge's pink with its dark ink (the
 * same in light and dark, so the label and count always read), an active category is a soft lift.
 * Inactive filters all share the muted ink.
 */
export function FilterButton({ label, count, active, tone, onClick }: { label: string; count: number; active: boolean; tone?: "all" | "new"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        active
          ? tone === "all" ? "bg-accent text-black" : tone === "new" ? "bg-[#ff8fb8] text-[#2a0714]" : "bg-white/[0.09] text-foreground"
          : "text-muted hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("text-[11px] tabular-nums", active ? (tone === "new" ? "text-[#2a0714]/60" : tone ? "text-black/55" : "text-muted") : "text-subtle")}>{count}</span>
    </button>
  );
}

/**
 * The piece the new wave opens with, in "Just added" and on the New tab; the rest of the wave keeps
 * registry order behind it. Once it is no longer new this does nothing, so it never needs undoing.
 */
const NEW_LEAD = "PictureHeadline";

/** `narrow` caps the grid at three columns, for a docs column rather than the full page. */
export function ShowcaseGrid({ items, filters = true, limit, narrow }: { items: RegistryIndexEntry[]; filters?: boolean; limit?: number; narrow?: boolean }) {
  const [cat, setCat] = useState<string>("all");
  const fresh = useMemo(() => items.filter((i) => i.isNew).sort((a, b) => Number(b.name === NEW_LEAD) - Number(a.name === NEW_LEAD)), [items]);
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
        <CardGrid key={cat} items={shown} narrow={narrow} />
      )}
    </div>
  );
}
