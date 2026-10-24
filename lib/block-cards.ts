// One card per block, free and Pro, in the order the library shows them: by category (lib/blocks.ts order), free
// before Pro inside a category. Built on the server from the registry, so the grid's client chunk never carries it.
import { blockCategories, blockPath, proBlockUrl, type BlockCategory } from "@/lib/blocks";
import { getBlocks, getProBlocks, getRegistryItem } from "@/lib/registry";
import { piecePath } from "@/lib/registry-paths";

export type BlockCard = {
  kind: "free" | "pro";
  /** The Swift type: the preview key for a free block, the install name for both. */
  name: string;
  title: string;
  summary: string;
  category: BlockCategory;
  categoryTitle: string;
  /** Its docs page on this site. */
  href: string;
  /** Pro blocks: where it opens in Pro's library. */
  proHref?: string;
  /** Pro blocks: a still of Pro's own preview card (public/pro-blocks/<id>.webp), its loop's first frame. */
  still?: string;
  /** Pro blocks: that card's loop, without its extension (public/pro-blocks/<id>.webm and .mp4). */
  loop?: string;
  isNew: boolean;
  /** Free blocks: the pieces inside, with their pages. Pro blocks: the parts Pro's library lists. */
  parts: { label: string; href?: string }[];
};

export function blockCards(): BlockCard[] {
  const free: BlockCard[] = getBlocks().map((b) => ({
    kind: "free",
    name: b.name,
    title: b.title,
    summary: b.description,
    category: b.category,
    categoryTitle: blockCategories[b.category].title,
    href: blockPath(b),
    isNew: b.isNew,
    parts: b.registryDependencies.map((dep) => {
      const piece = getRegistryItem(dep);
      return piece ? { label: piece.title, href: piecePath(piece) } : { label: dep };
    }),
  }));
  const pro: BlockCard[] = getProBlocks().map((p) => ({
    kind: "pro",
    name: p.name,
    title: p.title,
    summary: p.summary,
    category: p.category,
    categoryTitle: blockCategories[p.category].title,
    href: blockPath(p),
    proHref: proBlockUrl(p.id),
    still: `/pro-blocks/${p.id}.webp`,
    loop: `/pro-blocks/${p.id}`,
    isNew: p.isNew,
    parts: p.parts.map((label) => ({ label })),
  }));
  const order = Object.keys(blockCategories) as BlockCategory[];
  const rank = (c: BlockCard) => order.indexOf(c.category) * 2 + (c.kind === "pro" ? 1 : 0);
  return [...free, ...pro].sort((a, b) => rank(a) - rank(b));
}

/** "4 free patterns and 2 in Pro". */
export function blockCountsLabel(): string {
  const free = getBlocks().length;
  const pro = getProBlocks().length;
  return `${free} free ${free === 1 ? "pattern" : "patterns"} and ${pro} in Pro`;
}
