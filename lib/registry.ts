// Reads of the generated registry. `index.json` never contains file contents;
// `items.json` (with contents) is only imported by the registry Route Handler.
import index from "@/registry/__registry__/index.json";
import type { RegistryIndexEntry, RegistryItem } from "@/lib/registry-schema";
// Pure helpers live in registry-paths.ts so client components never pull the registry JSON into a chunk.
export { cliCommand, mcpPrompt, piecePath } from "@/lib/registry-paths";

const entries = index as RegistryIndexEntry[];
const byName = new Map(entries.map((e) => [e.name, e]));
const bySlug = new Map(entries.map((e) => [e.slug, e]));

export function getRegistryIndex(): RegistryIndexEntry[] {
  return entries;
}

export function getRegistryItem(name: string): RegistryIndexEntry | null {
  return byName.get(name) ?? bySlug.get(name) ?? null;
}

export function getRegistryByCategory(category: RegistryIndexEntry["category"]): RegistryIndexEntry[] {
  return entries.filter((e) => e.category === category);
}

export async function loadFullRegistryItem(name: string): Promise<RegistryItem | null> {
  const mod = await import("@/registry/__registry__/items.json");
  const items = (mod.default ?? mod) as Record<string, RegistryItem>;
  const entry = getRegistryItem(name);
  return entry ? (items[entry.name] ?? null) : null;
}

