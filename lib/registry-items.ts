// The registry's full items (with file contents), for the Route Handlers that serve sources: the
// registry route, MCP and "Open in Xcode". Kept out of lib/registry.ts because every page imports
// that, and even an unused dynamic import there gave the pages their own copy of items.json (about
// 1.2 MB compressed) in the Worker.
import type { RegistryItem } from "@/lib/registry-schema";
import { getRegistryItem } from "@/lib/registry";

export async function loadFullRegistryItem(name: string): Promise<RegistryItem | null> {
  const mod = await import("@/registry/__registry__/items.json");
  const items = (mod.default ?? mod) as Record<string, RegistryItem>;
  const entry = getRegistryItem(name);
  return entry ? (items[entry.name] ?? null) : null;
}
