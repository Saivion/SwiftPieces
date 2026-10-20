// Reads of the generated registry. `index.json` never contains file contents;
// `items.json` (with contents) is only read through lib/registry-items.ts, by the Route Handlers.
import index from "@/registry/__registry__/index.json";
import blockIndex from "@/registry/__registry__/blocks.json";
import proBlockIndex from "@/registry/__registry__/pro-blocks.json";
import type { BlockIndexEntry, RegistryIndexEntry } from "@/lib/registry-schema";
import type { ProBlock } from "@/lib/blocks";
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

// Blocks (lib/blocks.ts): free blocks from the registry build, and Pro's, listed by name with their New badge.
const blocks = blockIndex as unknown as BlockIndexEntry[];
const blockByName = new Map(blocks.map((b) => [b.name, b]));
const blockBySlug = new Map(blocks.map((b) => [b.slug, b]));
export type ListedProBlock = ProBlock & { slug: string; isNew: boolean };
const proBlocks = proBlockIndex as unknown as ListedProBlock[];

export function getBlocks(): BlockIndexEntry[] {
  return blocks;
}

export function getBlock(name: string): BlockIndexEntry | null {
  return blockByName.get(name) ?? blockBySlug.get(name) ?? null;
}

export function getProBlocks(): ListedProBlock[] {
  return proBlocks;
}

export function getProBlock(id: string): ListedProBlock | null {
  return proBlocks.find((p) => p.id === id || p.name === id) ?? null;
}



/** How many pieces carry the New badge right now: the latest wave, while it is recent (scripts/build-registry.ts). */
export function freshCount(): number {
  return getRegistryIndex().filter((e) => e.isNew).length;
}
