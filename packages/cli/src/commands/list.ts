import { DEFAULT_REGISTRIES, findConfig, readLicenseKey } from "../config.js";
import { fetchIndex } from "../registry.js";
import { fetchKitIndex } from "../kit.js";

export async function list(opts: { category?: string; json?: boolean; pro?: boolean; kit?: boolean }) {
  const registries = findConfig()?.config.registries ?? DEFAULT_REGISTRIES;
  if (opts.kit) {
    const kit = await fetchKitIndex(registries.pro);
    if (opts.json) return void console.log(JSON.stringify(kit, null, 2));
    const byKind = new Map<string, typeof kit>();
    for (const i of kit) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i]);
    for (const [kind, items] of byKind) {
      console.log(`\n${kind}`);
      for (const i of items) console.log(`  ${i.id.padEnd(28)} ${i.availability === "free" ? "free " : "     "} ${i.title}`);
    }
    console.log(`\n${kit.length} Build Kit items. Install for your agent with: npx swiftpieces add <id> [--agent claude|codex|cursor|xcode]`);
    return;
  }
  const registry = opts.pro ? registries.pro : registries.free;
  const items = await fetchIndex(registry);
  const filtered = opts.category ? items.filter((i) => i.category === opts.category) : items;
  if (opts.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }
  const byCat = new Map<string, typeof filtered>();
  for (const i of filtered) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);
  for (const [cat, list] of byCat) {
    console.log(`\n${cat}`);
    for (const i of list) console.log(`  ${i.name.padEnd(26)} iOS ${i.minIOSVersion.padEnd(5)} ${(i.type ?? "free").padEnd(9)} ${i.description}`);
  }
  console.log(`\n${filtered.length} pieces from ${registry}. Add one with: npx swiftpieces add <Name>`);
  if (!opts.pro) console.log(`Swift Pieces Pro screens and app templates: npx swiftpieces list --pro · Build Kit: npx swiftpieces list --kit${readLicenseKey() ? "" : "  (npx swiftpieces login to install them)"}`);
}
