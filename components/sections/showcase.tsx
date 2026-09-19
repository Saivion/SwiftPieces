"use client";
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
            <p className="p-item">{item.title}</p>
            <p className="p-body mt-2 line-clamp-2 text-[13.5px]">{item.description}</p>
          </PanelBody>
        </Panel>
      </Link>
    </RevealItem>
  );
}

export function ShowcaseGrid({ items, filters = true, limit }: { items: RegistryIndexEntry[]; filters?: boolean; limit?: number }) {
  const [cat, setCat] = useState<string>("all");
  const cats = useMemo(() => ["all", ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const shown = useMemo(() => {
    const f = cat === "all" ? items : items.filter((i) => i.category === cat);
    return limit ? f.slice(0, limit) : f;
  }, [cat, items, limit]);

  return (
    <div>
      {filters ? (
        <div className="-mx-5 mb-12 flex gap-1 overflow-x-auto px-5 sm:mx-0 sm:px-0 [scrollbar-width:none]">
          {cats.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={cn("relative h-9 shrink-0 rounded-[10px] px-3.5 text-sm font-medium transition-colors", cat === c ? "bg-accent text-black" : "text-muted hover:text-foreground")}>
              {c === "all" ? "All" : categoryTitle(c)}
              <span className={cn("ml-1.5 text-[11px]", cat === c ? "text-black/60" : "text-subtle")}>{c === "all" ? items.length : items.filter((i) => i.category === c).length}</span>
              
            </button>
          ))}
        </div>
      ) : null}
      <RevealGroup key={cat} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" stagger={0.04}>
        {shown.map((item, i) => (
          <ComponentCard key={item.name} item={item} index={i} />
        ))}
      </RevealGroup>
    </div>
  );
}
