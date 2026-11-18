import { getRegistryIndex, getRegistryItem } from "@/lib/registry";
import { categories, categoryTitle } from "@/lib/categories";
import { piecePath } from "@/lib/registry-paths";

export type StillPiece = { name: string; title: string; category: string; href: string; light: string; dark: string };

/** A piece's rendered preview stills (public/previews/<category>/<slug>/), light and dark, 1200x900. */
export function still(name: string): StillPiece | null {
  const item = getRegistryItem(name);
  if (!item) return null;
  const base = `/previews/${categories[item.category].slug}/${item.slug}/${item.slug}`;
  return { name, title: item.title, category: categoryTitle(item.category), href: piecePath(item), light: `${base}-light.webp`, dark: `${base}-dark.webp` };
}

export function stills(names: string[]): StillPiece[] {
  return names.map(still).filter((s): s is StillPiece => s !== null);
}

/** Every piece's stills, in registry order. */
export function allStills(): StillPiece[] {
  return stills(getRegistryIndex().map((i) => i.name));
}
