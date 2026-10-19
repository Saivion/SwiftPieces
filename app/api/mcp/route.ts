import { createMcpHandler } from "@/lib/mcp/server";
import { getBlocks, getProBlocks, getRegistryIndex, getRegistryItem, cliCommand } from "@/lib/registry";
import { loadFullBlock, loadFullRegistryItem } from "@/lib/registry-items";
import { blockCategoryIds, proBlockUrl } from "@/lib/blocks";
import { pro, site } from "@/lib/site";
import { categoryIds } from "@/lib/categories";

// Free MCP: public, no auth, free tools only (Rev 3 §9). Pro tools live on pro.swiftpieces.com/api/mcp.
const glassGuide = `Liquid Glass rules for SwiftUI (iOS 26):
1. Gate with #available(iOS 26, *) and provide a Material fallback in the else branch.
2. Respect @Environment(\\.accessibilityReduceTransparency): use an opaque surface when it is on.
3. Wrap sibling glass views in one GlassEffectContainer(spacing:) so they render as one layer and can morph.
4. Apply .glassEffect after layout and appearance modifiers.
5. Pair .glassEffectID(_:in:) with a @Namespace to morph between shapes.
6. Only real APIs: glassEffect(_:in:), Glass.regular/.clear/.identity, .tint(_:), .interactive(_:), GlassEffectContainer, glassEffectID, glassEffectUnion, .buttonStyle(.glass), .glassProminent. Never .liquidGlassUltra.
Guide: ${site.url}/docs/liquid-glass`;

export const POST = createMcpHandler({
  name: "swiftpieces",
  version: "0.1.0",
  instructions: `Search and install free SwiftPieces (MIT + Commons Clause): pieces, single designed interactions, and blocks, whole sections of a screen built from pieces (a block installs with the pieces it names in registryDependencies). For SwiftPieces Pro screens, blocks, flows and app templates use the Pro server at ${pro.mcp} with a license key.`,
  tools: [
    {
      name: "search_pieces",
      description: "Search the free SwiftPieces registry by keyword, optionally filtered by category or minimum iOS version.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, category: { type: "string", enum: [...categoryIds] }, maxIOS: { type: "string", description: "Only pieces whose minIOSVersion is at most this, e.g. 17.0" } } },
      handler: ({ query, category, maxIOS }) => {
        const q = String(query ?? "").toLowerCase();
        return getRegistryIndex()
          .filter((i) => !category || i.category === category)
          .filter((i) => !maxIOS || parseFloat(i.minIOSVersion) <= parseFloat(String(maxIOS)))
          .filter((i) => !q || [i.name, i.title, i.description, ...i.tags].join(" ").toLowerCase().includes(q))
          .map(({ name, title, description, category, minIOSVersion, liquidGlass, metal, docs }) => ({ name, title, description, category, minIOSVersion, liquidGlass, metal, docs }));
      },
    },
    {
      name: "search_blocks",
      description: "Search SwiftPieces blocks (whole sections of a screen built from pieces, such as sign in, account settings, a stats overview or checkout) by keyword, optionally by block category. Free blocks install with get_piece/install_piece; Pro blocks come from the Pro server.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, category: { type: "string", enum: [...blockCategoryIds] } } },
      handler: ({ query, category }) => {
        const q = String(query ?? "").toLowerCase();
        const match = (text: string) => !q || text.toLowerCase().includes(q);
        const free = getBlocks()
          .filter((b) => !category || b.category === category)
          .filter((b) => match([b.name, b.title, b.description, ...b.tags].join(" ")))
          .map(({ name, title, description, category, minIOSVersion, registryDependencies, docs }) => ({ name, title, description, category, minIOSVersion, builtFrom: registryDependencies, docs, availability: "free" }));
        const paid = getProBlocks()
          .filter((p) => !category || p.category === category)
          .filter((p) => match([p.name, p.title, p.summary, p.description].join(" ")))
          .map(({ name, title, summary, category, parts, id }) => ({ name, title, description: summary, category, inside: parts, availability: "pro", pro: proBlockUrl(id) }));
        return [...free, ...paid];
      },
    },
    {
      name: "get_piece",
      description: "Return a free piece's or free block's full source, shaders, metadata and docs URL. A block lists the pieces it is built from in registryDependencies.",
      inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      handler: async ({ name }) => {
        const item = (await loadFullRegistryItem(String(name))) ?? (await loadFullBlock(String(name)));
        if (!item) throw new Error(`No free piece or block named "${name}". If it is a Pro screen, block, flow or template, use the Pro MCP at ${pro.mcp}.`);
        return item;
      },
    },
    {
      name: "install_piece",
      description: "Return the files to write (path + content) so the agent can install a piece or block into an Xcode 16 synchronized folder, plus the equivalent CLI command. For a block, also install each name in registryDependencies (the pieces it is built from).",
      inputSchema: { type: "object", properties: { name: { type: "string" }, projectPath: { type: "string", description: "Absolute path to the app source folder that contains SwiftPieces/" } }, required: ["name"] },
      handler: async ({ name, projectPath }) => {
        const item = (await loadFullRegistryItem(String(name))) ?? (await loadFullBlock(String(name)));
        if (!item) throw new Error(`No free piece or block named "${name}".`);
        const base = projectPath ? String(projectPath).replace(/\/$/, "") : ".";
        const files = [...item.files, ...item.shaders, ...item.assets].map((f) => ({ path: `${base}/${f.target}`, content: f.content }));
        return { command: cliCommand(item), files, requirements: { infoPlist: item.infoPlist, capabilities: item.requiredCapabilities, spm: item.spmDependencies }, registryDependencies: item.registryDependencies };
      },
    },
    {
      name: "list_categories",
      description: "List free piece categories and block categories with counts, and links to the SwiftPieces Pro library (screens, blocks, flows and app templates).",
      inputSchema: { type: "object", properties: {} },
      handler: () => {
        const counts: Record<string, number> = {};
        for (const i of getRegistryIndex()) counts[i.category] = (counts[i.category] ?? 0) + 1;
        const blocks: Record<string, { free: number; pro: number }> = {};
        for (const b of getBlocks()) (blocks[b.category] ??= { free: 0, pro: 0 }).free += 1;
        for (const p of getProBlocks()) (blocks[p.category] ??= { free: 0, pro: 0 }).pro += 1;
        return { free: counts, blocks, pro: { library: pro.library, screens: pro.screens, blocks: `${pro.library}/blocks`, flows: pro.flows, templates: pro.templates, mcp: pro.mcp } };
      },
    },
    {
      name: "get_liquid_glass_guide",
      description: "The rules for correct Liquid Glass adoption with verified iOS 26 API names.",
      inputSchema: { type: "object", properties: {} },
      handler: () => glassGuide,
    },
  ],
});

// Streamable HTTP clients GET here to open a server-to-client event stream. We don't offer one,
// and the spec's answer is 405: anything else (a 200 that ends at once) reads as a dropped stream
// and the client reconnects in a loop. Browsers and people still get the endpoint's description.
export function GET(req: Request) {
  if (req.headers.get("accept")?.includes("text/event-stream")) return new Response(null, { status: 405, headers: { Allow: "POST" } });
  return Response.json({ name: "swiftpieces", transport: "streamable-http", endpoint: `${site.url}/api/mcp`, pro: pro.mcp });
}
