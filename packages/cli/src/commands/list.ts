import { DEFAULT_REGISTRIES, findConfig, readLicenseKey } from "../config.js";
import { fetchIndex, type FetchPolicy } from "../registry.js";
import { fetchKitIndex } from "../kit.js";

export async function list(opts: { category?: string; json?: boolean; pro?: boolean; kit?: boolean; allowHttpLocalhost?: boolean; trustRegistry?: boolean }) {
  const policy: FetchPolicy = { allowHttpLocalhost: opts.allowHttpLocalhost, trustRegistry: opts.trustRegistry };
  const registries = findConfig()?.config.registries ?? DEFAULT_REGISTRIES;
  if (opts.kit) {
    const kit = await fetchKitIndex(registries.pro, policy);
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
  const items = await fetchIndex(registry, policy);
  const filtered = opts.category ? items.filter((i) => i.category === opts.category) : items;
  if (opts.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }
  // Blocks (whole sections of a screen, `type: "registry:block"`) list after the pieces, under their own heading.
  const isBlock = (i: (typeof filtered)[number]) => i.type === "registry:block";
  const print = (title: (cat: string) => string, list: typeof filtered) => {
    const byCat = new Map<string, typeof filtered>();
    for (const i of list) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);
    for (const [cat, items] of byCat) {
      console.log(`\n${title(cat)}`);
      for (const i of items) console.log(`  ${i.name.padEnd(26)} iOS ${i.minIOSVersion.padEnd(5)} ${(isBlock(i) ? "block" : (i.type ?? "free")).padEnd(9)} ${i.description}`);
    }
  };
  const pieces = filtered.filter((i) => !isBlock(i));
  const blocks = filtered.filter(isBlock);
  print((cat) => cat, pieces);
  print((cat) => `blocks · ${cat}`, blocks);
  console.log(`\n${pieces.length} pieces${blocks.length ? ` and ${blocks.length} blocks` : ""} from ${registry}. Add one with: npx swiftpieces add <Name>${blocks.length ? " (a block brings the pieces it is built from)" : ""}`);
  if (!opts.pro) console.log(`SwiftPieces Pro screens and app templates: npx swiftpieces list --pro · Build Kit: npx swiftpieces list --kit${readLicenseKey() ? "" : "  (npx swiftpieces login to install them)"}`);
}
