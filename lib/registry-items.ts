// Full registry items, file contents included. Imported only by Route Handlers (the registry API, the MCP server and
// the Xcode clone), so items.json lands in the server bundle once and never in a page's chunks.
import type { RegistryItem } from "@/lib/registry-schema";
import { getRegistryItem } from "@/lib/registry";

export async function loadFullRegistryItem(name: string): Promise<RegistryItem | null> {
  const mod = await import("@/registry/__registry__/items.json");
  const items = (mod.default ?? mod) as Record<string, RegistryItem>;
  const entry = getRegistryItem(name);
  return entry ? (items[entry.name] ?? null) : null;
}
