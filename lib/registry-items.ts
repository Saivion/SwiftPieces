// The registry's full items (with file contents), for the Route Handlers that serve sources: the
// registry route, MCP and "Open in Xcode". Kept out of lib/registry.ts because every page imports
// that, and even an unused dynamic import there gave the pages their own copy of items.json (about
// 1.2 MB compressed) in the Worker.
import type { BlockItem, RegistryItem } from "@/lib/registry-schema";
import { getBlock, getRegistryItem } from "@/lib/registry";

export async function loadFullRegistryItem(name: string): Promise<RegistryItem | null> {
  const mod = await import("@/registry/__registry__/items.json");
  const items = (mod.default ?? mod) as Record<string, RegistryItem>;
  const entry = getRegistryItem(name);
  return entry ? (items[entry.name] ?? null) : null;
}

/** A free block with its source. items.json holds the blocks beside the pieces, keyed by name. */
export async function loadFullBlock(name: string): Promise<BlockItem | null> {
  const entry = getBlock(name);
  if (!entry) return null;
  const mod = await import("@/registry/__registry__/items.json");
  const items = (mod.default ?? mod) as unknown as Record<string, BlockItem>;
  return items[entry.name] ?? null;
}
