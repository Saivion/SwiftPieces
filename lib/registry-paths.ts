// Pure, data-free helpers. Safe to import from client components: importing lib/registry from a
// client module would make the bundler emit the full registry (with Swift sources) as a client chunk.
import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { categories } from "@/lib/categories";

export function cliCommand(item: Pick<RegistryIndexEntry, "name">): string {
  return `npx swiftpieces add ${item.name}`;
}

export function mcpPrompt(item: Pick<RegistryIndexEntry, "title">): string {
  return `Add the Swift Pieces "${item.title}" piece to my app`;
}

/** Canonical docs path: /docs/components/<category>/<slug>. Every link to a piece must use this. */
export function piecePath(item: Pick<RegistryIndexEntry, "category" | "slug">): string {
  return `/docs/components/${categories[item.category].slug}/${item.slug}`;
}
