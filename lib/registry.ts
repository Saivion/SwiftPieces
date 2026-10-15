// Reads of the generated registry. `index.json` never contains file contents;
// `items.json` (with contents) is only read through lib/registry-items.ts, by the Route Handlers.
import index from "@/registry/__registry__/index.json";
import type { RegistryIndexEntry } from "@/lib/registry-schema";
// Pure helpers live in registry-paths.ts so client components never pull the registry JSON into a chunk.
export { cliCommand, mcpPrompt, piecePath } from "@/lib/registry-paths";

// Generated JSON is a literal union. Two Info.plist shapes (location and motion) make that union
// not overlap Record<string, string>, so the cast goes through unknown. The registry build already
// validated every entry.
const entries = index as unknown as RegistryIndexEntry[];
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

/** How many pieces carry the New badge right now: the latest wave, while it is recent (scripts/build-registry.ts). */
export function freshCount(): number {
  return getRegistryIndex().filter((e) => e.isNew).length;
}
